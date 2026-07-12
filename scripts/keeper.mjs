/**
 * StockDotFun V2 conversion keeper.
 *
 * Periodically converts each pool's pending holder+creator WETH into the paired
 * stock token via StockRewardTreasury.convertPending. It is SAFE by construction:
 *   - size is bounded by the route's maxWethPerConversion (and the pending amount)
 *   - minStockOut is derived from a live V4Quoter quote minus the route's slippage
 *     tolerance (anti-sandwich) — never 0
 *   - pools in PAUSED / LOW_LIQUIDITY state are skipped
 * The keeper key can ONLY trigger this bounded action; it cannot move funds,
 * pick tokens/recipients/routes, or change config.
 *
 * Env: RHC_RPC_URL, KEEPER_PRIVATE_KEY, and optionally FACTORY_ADDRESS /
 *      TREASURY_ADDRESS / ROUTE_REGISTRY_ADDRESS (default to the live V2 addrs).
 * Run once:   node scripts/keeper.mjs
 * Run loop:   node scripts/keeper.mjs --loop        (every KEEPER_INTERVAL_S, default 300)
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  getAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = process.env.RHC_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const FACTORY = getAddress(process.env.FACTORY_ADDRESS || "0x470aca74d71269833de8cf65640dfb558393569e");
const TREASURY = getAddress(process.env.TREASURY_ADDRESS || "0x284c47ef1754fa82b85cbe8207dd749e6f9ca389");
const REGISTRY = getAddress(process.env.ROUTE_REGISTRY_ADDRESS || "0xf1c7181324dec91bf0fb94a2f05608927e06b97c");
const V4_QUOTER = getAddress("0x8dc178efb8111bb0973dd9d722ebeff267c98f94");
const WETH = getAddress("0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73");
const USDG = getAddress("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168");
const NATIVE = "0x0000000000000000000000000000000000000000";

const MIN_CONVERT_WEI = BigInt(process.env.KEEPER_MIN_WEI || "10000000000000000"); // 0.01 WETH floor
const INTERVAL_S = Number(process.env.KEEPER_INTERVAL_S || 300);

const chain = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

const pub = createPublicClient({ chain, transport: http(RPC) });

const FACTORY_ABI = parseAbi([
  "function allTokensLength() view returns (uint256)",
  "function allTokens(uint256) view returns (address)",
  "function poolOf(address) view returns (address)",
]);
const TREASURY_ABI = parseAbi([
  "function pools(address) view returns (bool registered, address stock, address holderVault, address creator, uint256 pendingHolderWeth, uint256 pendingCreatorWeth, uint256 pendingProtocolWeth, uint8 state)",
  "function convertPending(address pool, uint256 maxWeth, uint256 minStockOut, uint256 deadline)",
]);
const REGISTRY_ABI = [
  {
    type: "function",
    name: "getRoute",
    stateMutability: "view",
    inputs: [{ name: "stock", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "status", type: "uint8" },
          { name: "baseInputIsNative", type: "bool" },
          {
            name: "baseHop",
            type: "tuple",
            components: [
              { name: "currency0", type: "address" },
              { name: "currency1", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hooks", type: "address" },
            ],
          },
          {
            name: "stockHop",
            type: "tuple",
            components: [
              { name: "currency0", type: "address" },
              { name: "currency1", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hooks", type: "address" },
            ],
          },
          { name: "maxWethPerConversion", type: "uint128" },
          { name: "maxSlippageBps", type: "uint16" },
          { name: "maxRouteAge", type: "uint64" },
          { name: "lastValidatedAt", type: "uint64" },
        ],
      },
    ],
  },
];
// quoteExactInputSingle is non-view but returns via eth_call; declare view.
const QUOTER_ABI = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "view",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          {
            name: "poolKey",
            type: "tuple",
            components: [
              { name: "currency0", type: "address" },
              { name: "currency1", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hooks", type: "address" },
            ],
          },
          { name: "zeroForOne", type: "bool" },
          { name: "exactAmount", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
];

const eq = (a, b) => a.toLowerCase() === b.toLowerCase();
const STATE = ["PENDING", "ACTIVE", "PAUSED", "LOW_LIQUIDITY", "FAILED"];

async function quoteSingle(key, zeroForOne, amountIn) {
  const r = await pub.readContract({
    address: V4_QUOTER,
    abi: QUOTER_ABI,
    functionName: "quoteExactInputSingle",
    args: [{ poolKey: key, zeroForOne, exactAmount: amountIn, hookData: "0x" }],
  });
  return r[0];
}

/** Quote WETH -> USDG -> stock for `amountWeth`, return expected stock out. */
async function quoteRoute(route, amountWeth) {
  const baseTok = route.baseInputIsNative ? NATIVE : WETH;
  const z1 = eq(route.baseHop.currency0, baseTok);
  const usdgOut = await quoteSingle(route.baseHop, z1, amountWeth);
  if (!usdgOut || usdgOut === 0n) return 0n;
  const z2 = eq(route.stockHop.currency0, USDG);
  return await quoteSingle(route.stockHop, z2, usdgOut);
}

async function runOnce(wallet, account) {
  const len = await pub.readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: "allTokensLength" });
  console.log(`[keeper] ${len} tokens; scanning pools…`);
  let converted = 0;
  for (let i = 0n; i < len; i++) {
    const token = await pub.readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: "allTokens", args: [i] });
    const pool = await pub.readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: "poolOf", args: [token] });
    const info = await pub.readContract({ address: TREASURY, abi: TREASURY_ABI, functionName: "pools", args: [pool] });
    const [registered, stock, , , pendingHolder, pendingCreator, , state] = info;
    if (!registered) continue;
    const pending = pendingHolder + pendingCreator;
    if (state === 2 || state === 3) continue; // PAUSED / LOW_LIQUIDITY
    if (pending < MIN_CONVERT_WEI) continue;

    const route = await pub.readContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: "getRoute", args: [stock] });
    if (route.status !== 2) continue; // not VERIFIED

    const cap = route.maxWethPerConversion === 0n ? pending : route.maxWethPerConversion;
    const amount = pending < cap ? pending : cap;
    let expectedStock;
    try {
      expectedStock = await quoteRoute(route, amount);
    } catch (e) {
      console.log(`[keeper] pool ${pool}: quote failed (${String(e).slice(0, 60)}) — skip`);
      continue;
    }
    if (!expectedStock || expectedStock === 0n) continue;
    const minStockOut = (expectedStock * BigInt(10000 - route.maxSlippageBps)) / 10000n;
    if (minStockOut === 0n) continue;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

    try {
      const hash = await wallet.writeContract({
        address: TREASURY,
        abi: TREASURY_ABI,
        functionName: "convertPending",
        args: [pool, amount, minStockOut, deadline],
        account,
        chain,
      });
      await pub.waitForTransactionReceipt({ hash });
      console.log(`[keeper] converted pool ${pool} (${amount} wei, state ${STATE[state]}) tx ${hash}`);
      converted++;
    } catch (e) {
      console.log(`[keeper] pool ${pool}: convert reverted (${String(e).slice(0, 80)})`);
    }
  }
  console.log(`[keeper] pass complete — ${converted} conversion(s)`);
}

async function main() {
  const pk = process.env.KEEPER_PRIVATE_KEY;
  if (!pk) throw new Error("KEEPER_PRIVATE_KEY not set");
  const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
  const wallet = createWalletClient({ chain, transport: http(RPC), account });
  console.log(`[keeper] keeper=${account.address} treasury=${TREASURY}`);

  if (process.argv.includes("--loop")) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await runOnce(wallet, account);
      } catch (e) {
        console.error("[keeper] pass error:", e);
      }
      await new Promise((r) => setTimeout(r, INTERVAL_S * 1000));
    }
  } else {
    await runOnce(wallet, account);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
