/**
 * Part 2 — Real stock-token liquidity discovery on Robinhood Chain (4663).
 *
 * For every canonical Robinhood stock/ETF token this script:
 *   1. Enumerates the token's Uniswap V4 pools directly from PoolManager
 *      `Initialize` events (so we see the EXACT fee tier + hooks, never guessed).
 *   2. Keeps only pools paired with the routing hub USDG, or with WETH/native ETH.
 *   3. Reads live liquidity + slot0 from StateView.
 *   4. Executes read-only V4Quoter quotes along WETH -> USDG -> stock at
 *      0.001 / 0.01 / 0.05 / 0.10 / 0.25 / 0.50 WETH, measuring output and
 *      price impact.
 *   5. Classifies each asset VERIFIED / LOW_LIQUIDITY / DISABLED against
 *      configurable thresholds.
 *
 * Outputs:
 *   docs/integrations/stock-liquidity-report.md
 *   config/verified-stock-routes.json
 *
 * Read-only. Spends no funds. Run: node scripts/discover-stock-liquidity.mjs
 */
import { createPublicClient, http, parseAbi, encodeAbiParameters, keccak256, getAddress } from "viem";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RPC = process.env.RHC_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";

const chain = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};
const client = createPublicClient({ chain, transport: http(RPC, { batch: false }) });

// ---- Canonical addresses (verified in Part 1 + Robinhood docs) ----
const WETH = getAddress("0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73");
const USDG = getAddress("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168");
const NATIVE = "0x0000000000000000000000000000000000000000";
const POOL_MANAGER = getAddress("0x8366a39cc670b4001a1121b8f6a443a643e40951");
const STATE_VIEW = getAddress("0xf3334192d15450cdd385c8b70e03f9a6bd9e673b");
const V4_QUOTER = getAddress("0x8dc178efb8111bb0973dd9d722ebeff267c98f94");

const STOCKS = {
  AAPL: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
  AMD: "0x86923f96303D656E4aa86D9d42D1e57ad2023fdC",
  AMZN: "0x12f190a9F9d7D37a250758b26824B97CE941bF54",
  BABA: "0xad25Ac6C84D497db898fa1E8387bf6Af3532a1c4",
  BE: "0x822CC93fFD030293E9842c30BBD678F530701867",
  COIN: "0x6330D8C3178a418788dF01a47479c0ce7CCF450b",
  CRCL: "0xdF0992E440dD0be65BD8439b609d6D4366bf1CB5",
  CRWV: "0x5f10A1C971B69e47e059e1dC91901B59b3fB49C3",
  GOOGL: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3",
  INTC: "0xc72b96e0E48ecd4DC75E1e45396e26300BC39681",
  META: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35",
  MSFT: "0xe93237C50D904957Cf27E7B1133b510C669c2e74",
  MU: "0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD",
  NVDA: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
  ORCL: "0xb0992820E760d836549ba69BC7598b4af75dEE03",
  PLTR: "0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A",
  SNDK: "0xB90A19fF0Af67f7779afF50A882A9CfF42446400",
  SPCX: "0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa",
  TSLA: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d",
  USAR: "0xd917B029C761D264c6A312BBbcDA868658eF86a6",
  QQQ: "0xD5f3879160bc7c32ebb4dC785F8a4F505888de68",
  SGOV: "0x92FD66527192E3e61d4DDd13322Aa222DE86F9B5",
  SLV: "0x411eFb0E7f985935DAec3D4C3ebaEa0d0AD7D89f",
  SPY: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C",
  USO: "0xa30FA36Db767ad9eD3f7a60fC79526fB4d56D344",
};

// ---- Thresholds (configurable route-verification policy) ----
const THRESHOLDS = {
  minLiquidityRaw: 1n, // pool must be initialized with nonzero liquidity
  maxPriceImpactPct: 3.0, // reject a size if impact exceeds this
  minVerifiedSizeWeth: 0.05, // must quote cleanly at >= this size to be VERIFIED
  quoteSizesWeth: [0.001, 0.01, 0.05, 0.1, 0.25, 0.5],
};

const INIT_EVENT = parseAbi([
  "event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)",
])[0];

const STATE_VIEW_ABI = parseAbi([
  "function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)",
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
]);

// V4Quoter.quoteExactInputSingle is non-view but returns via eth_call; declare
// it `view` locally so viem will eth_call it and decode the return.
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

function computePoolId(key) {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" },
      ],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
    ),
  );
}

async function poolsFor(tokenAddr) {
  // Query as currency0 and as currency1 (both indexed) separately.
  const asC0 = await client.getLogs({
    address: POOL_MANAGER,
    event: INIT_EVENT,
    args: { currency0: tokenAddr },
    fromBlock: 0n,
    toBlock: "latest",
  });
  const asC1 = await client.getLogs({
    address: POOL_MANAGER,
    event: INIT_EVENT,
    args: { currency1: tokenAddr },
    fromBlock: 0n,
    toBlock: "latest",
  });
  const out = [];
  for (const log of [...asC0, ...asC1]) {
    const a = log.args;
    out.push({
      currency0: getAddress(a.currency0),
      currency1: getAddress(a.currency1),
      fee: a.fee,
      tickSpacing: a.tickSpacing,
      hooks: getAddress(a.hooks),
      id: a.id,
    });
  }
  // de-dupe by id
  const seen = new Set();
  return out.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

async function liquidityOf(poolId) {
  try {
    return await client.readContract({
      address: STATE_VIEW,
      abi: STATE_VIEW_ABI,
      functionName: "getLiquidity",
      args: [poolId],
    });
  } catch {
    return 0n;
  }
}

async function quoteSingle(key, zeroForOne, amountIn) {
  try {
    const res = await client.readContract({
      address: V4_QUOTER,
      abi: QUOTER_ABI,
      functionName: "quoteExactInputSingle",
      args: [{ poolKey: key, zeroForOne, exactAmount: amountIn, hookData: "0x" }],
    });
    return res[0]; // amountOut
  } catch {
    return null;
  }
}

/** Pick the highest-liquidity pool from a candidate list. */
async function bestPool(pools) {
  let best = null;
  for (const p of pools) {
    const liq = await liquidityOf(p.id);
    if (liq > (best?.liq ?? -1n)) best = { ...p, liq };
  }
  return best && best.liq > 0n ? best : null;
}

async function main() {
  console.log(`Discovering stock liquidity on Robinhood Chain via ${RPC}\n`);

  // ---- Base hop: WETH/USDG or ETH/USDG (highest liquidity) ----
  const basePoolsRaw = [];
  for (const base of [WETH, NATIVE]) {
    const [lo, hi] = base.toLowerCase() < USDG.toLowerCase() ? [base, USDG] : [USDG, base];
    const logs = await client.getLogs({
      address: POOL_MANAGER,
      event: INIT_EVENT,
      args: { currency0: lo, currency1: hi },
      fromBlock: 0n,
      toBlock: "latest",
    });
    for (const log of logs) {
      const a = log.args;
      basePoolsRaw.push({
        currency0: getAddress(a.currency0),
        currency1: getAddress(a.currency1),
        fee: a.fee,
        tickSpacing: a.tickSpacing,
        hooks: getAddress(a.hooks),
        id: a.id,
        base,
      });
    }
  }
  const baseBest = await bestPool(basePoolsRaw);
  if (!baseBest) {
    console.error("FATAL: no WETH/ETH <-> USDG base pool with liquidity found. Cannot route from WETH.");
    process.exit(1);
  }
  const baseIsWethSide = eq(baseBest.currency0, WETH) || eq(baseBest.currency1, WETH);
  console.log(
    `Base hop: ${baseIsWethSide ? "WETH" : "ETH"}/USDG  fee=${baseBest.fee} liq=${baseBest.liq}  id=${baseBest.id}`,
  );
  const baseInputToken = baseIsWethSide ? WETH : NATIVE;
  const baseZeroForOne = eq(baseBest.currency0, baseInputToken); // selling base for USDG

  // ---- Per-asset discovery ----
  const results = [];
  for (const [sym, addrRaw] of Object.entries(STOCKS)) {
    const addr = getAddress(addrRaw);
    const pools = await poolsFor(addr);
    const usdgPools = pools.filter((p) => eq(p.currency0, USDG) || eq(p.currency1, USDG));
    const wethPools = pools.filter(
      (p) => eq(p.currency0, WETH) || eq(p.currency1, WETH) || eq(p.currency0, NATIVE) || eq(p.currency1, NATIVE),
    );
    const usdgBest = await bestPool(usdgPools);
    const stockDirectBest = await bestPool(wethPools);

    const sizes = [];
    for (const s of THRESHOLDS.quoteSizesWeth) {
      const amountIn = BigInt(Math.round(s * 1e18));
      // Hop 1: base -> USDG
      const usdgOut = await quoteSingle(
        { currency0: baseBest.currency0, currency1: baseBest.currency1, fee: baseBest.fee, tickSpacing: baseBest.tickSpacing, hooks: baseBest.hooks },
        baseZeroForOne,
        amountIn,
      );
      let stockOut = null;
      if (usdgBest && usdgOut && usdgOut > 0n) {
        // Hop 2: USDG -> stock
        const z = eq(usdgBest.currency0, USDG); // selling USDG for stock
        stockOut = await quoteSingle(
          { currency0: usdgBest.currency0, currency1: usdgBest.currency1, fee: usdgBest.fee, tickSpacing: usdgBest.tickSpacing, hooks: usdgBest.hooks },
          z,
          usdgOut,
        );
      }
      sizes.push({
        wethIn: s,
        usdgOut: usdgOut ? usdgOut.toString() : null,
        stockOut: stockOut ? stockOut.toString() : null,
        stockOutFloat: stockOut ? Number(stockOut) / 1e18 : null,
      });
    }

    // price impact: effective price (stock per WETH) at smallest vs each size
    const ref = sizes.find((x) => x.stockOutFloat && x.wethIn === 0.001);
    const refPrice = ref ? ref.stockOutFloat / ref.wethIn : null;
    let maxCleanSize = 0;
    for (const x of sizes) {
      if (!x.stockOutFloat || !refPrice) continue;
      const px = x.stockOutFloat / x.wethIn;
      x.priceImpactPct = (1 - px / refPrice) * 100;
      if (x.priceImpactPct <= THRESHOLDS.maxPriceImpactPct) maxCleanSize = Math.max(maxCleanSize, x.wethIn);
    }

    let status = "DISABLED";
    if (usdgBest) {
      if (maxCleanSize >= THRESHOLDS.minVerifiedSizeWeth) status = "VERIFIED";
      else if (sizes.some((x) => x.stockOutFloat)) status = "LOW_LIQUIDITY";
    }

    results.push({
      symbol: sym,
      address: addr,
      status,
      route: usdgBest
        ? { via: "WETH->USDG->stock", usdgPool: { fee: usdgBest.fee, tickSpacing: usdgBest.tickSpacing, hooks: usdgBest.hooks, id: usdgBest.id, liquidity: usdgBest.liq.toString() } }
        : null,
      directPool: stockDirectBest
        ? { fee: stockDirectBest.fee, tickSpacing: stockDirectBest.tickSpacing, hooks: stockDirectBest.hooks, id: stockDirectBest.id, liquidity: stockDirectBest.liq.toString() }
        : null,
      poolsFound: pools.length,
      usdgPoolsFound: usdgPools.length,
      maxCleanSizeWeth: maxCleanSize,
      sizes,
    });
    console.log(
      `${sym.padEnd(6)} ${status.padEnd(13)} usdgPools=${usdgPools.length} maxClean=${maxCleanSize} WETH`,
    );
  }

  // ---- Write outputs ----
  const base = {
    generatedAtBlock: (await client.getBlockNumber()).toString(),
    chainId: 4663,
    rpc: RPC,
    baseHop: { input: baseIsWethSide ? "WETH" : "ETH", fee: baseBest.fee, tickSpacing: baseBest.tickSpacing, hooks: baseBest.hooks, id: baseBest.id, liquidity: baseBest.liq.toString() },
    thresholds: THRESHOLDS,
    uniswap: { poolManager: POOL_MANAGER, stateView: STATE_VIEW, v4Quoter: V4_QUOTER },
    assets: results,
  };
  const bigintReplacer = (_k, v) => (typeof v === "bigint" ? v.toString() : v);
  mkdirSync(join(ROOT, "config"), { recursive: true });
  mkdirSync(join(ROOT, "docs", "integrations"), { recursive: true });
  writeFileSync(join(ROOT, "config", "verified-stock-routes.json"), JSON.stringify(base, bigintReplacer, 2));

  const verified = results.filter((r) => r.status === "VERIFIED");
  const low = results.filter((r) => r.status === "LOW_LIQUIDITY");
  const disabled = results.filter((r) => r.status === "DISABLED");
  const md = [
    "# Robinhood Chain — Stock-Token Liquidity Report (Part 2)",
    "",
    `Generated at block ${base.generatedAtBlock} against \`${RPC}\` (chain 4663). Read-only; no funds spent.`,
    "",
    `Base routing hop: **${base.baseHop.input}/USDG** fee=${base.baseHop.fee} (liquidity ${base.baseHop.liquidity}).`,
    "",
    "Thresholds: " +
      `min verified size **${THRESHOLDS.minVerifiedSizeWeth} WETH**, max price impact **${THRESHOLDS.maxPriceImpactPct}%**.`,
    "",
    `## Summary: ${verified.length} VERIFIED, ${low.length} LOW_LIQUIDITY, ${disabled.length} DISABLED`,
    "",
    "| Symbol | Status | USDG pools | Max clean size (WETH) | Best USDG pool fee |",
    "|---|---|---|---|---|",
    ...results.map(
      (r) =>
        `| ${r.symbol} | ${r.status} | ${r.usdgPoolsFound} | ${r.maxCleanSizeWeth} | ${r.route ? r.route.usdgPool.fee : "—"} |`,
    ),
    "",
    "## VERIFIED assets (eligible for production launches)",
    verified.length ? verified.map((r) => `- **${r.symbol}** ${r.address} — clean to ${r.maxCleanSizeWeth} WETH`).join("\n") : "_none_",
    "",
    "## Rejected for low/again liquidity",
    [...low, ...disabled].map((r) => `- ${r.symbol} (${r.status})`).join("\n") || "_none_",
    "",
    "Per-size quote detail is in `config/verified-stock-routes.json`.",
    "",
  ].join("\n");
  writeFileSync(join(ROOT, "docs", "integrations", "stock-liquidity-report.md"), md);

  console.log(`\nVERIFIED: ${verified.length}  LOW_LIQUIDITY: ${low.length}  DISABLED: ${disabled.length}`);
  console.log("Wrote config/verified-stock-routes.json and docs/integrations/stock-liquidity-report.md");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
