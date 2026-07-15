/**
 * Flap reward-fee accumulator keeper.
 *
 * Periodically converts the reward fees accumulated in ExternalFeeStockAccumulator
 * (native ETH, skimmed by the trading gateway) into tokenized stock, spread across
 * the reward vault's enabled basket by weight, delivered straight into the vault.
 * This self-funds the stock-reward inventory from real trading fees.
 *
 * Safe + inert by default: does nothing unless ACCUMULATOR_ADDRESS +
 * REWARD_VAULT_ADDRESS + KEEPER_PRIVATE_KEY are set AND pending >= MIN_ACCUMULATE_ETH.
 * Batches under the adapter's per-conversion size cap; the adapter enforces the
 * verified route + slippage internally.
 *
 * Env: RHC_RPC_URL, ACCUMULATOR_ADDRESS, REWARD_VAULT_ADDRESS, KEEPER_PRIVATE_KEY,
 *      MIN_ACCUMULATE_ETH (default 0.05), MAX_PER_CONVERSION_ETH (default 0.4).
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  getAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = process.env.RHC_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const ACCUMULATOR = process.env.ACCUMULATOR_ADDRESS;
const VAULT = process.env.REWARD_VAULT_ADDRESS;
const MIN = parseEther(process.env.MIN_ACCUMULATE_ETH || "0.05");
const MAX_PER = parseEther(process.env.MAX_PER_CONVERSION_ETH || "0.4");

const accumulatorAbi = [
  { type: "function", name: "pendingEth", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "accumulate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "stock", type: "address" },
      { name: "ethAmount", type: "uint256" },
      { name: "minStockOut", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
];

const vaultAbi = [
  { type: "function", name: "assetCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "assets", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "assetConfig",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [
      { name: "enabled", type: "bool" },
      { name: "weightBps", type: "uint16" },
      { name: "lotSize", type: "uint256" },
      { name: "minInventory", type: "uint256" },
      { name: "reserved", type: "uint256" },
    ],
  },
];

async function main() {
  if (!ACCUMULATOR || !VAULT) {
    console.log("[keeper] ACCUMULATOR_ADDRESS / REWARD_VAULT_ADDRESS not set — nothing to do.");
    return;
  }
  const pk = process.env.KEEPER_PRIVATE_KEY;
  if (!pk) {
    console.log("[keeper] KEEPER_PRIVATE_KEY not set — dry run only.");
  }

  const publicClient = createPublicClient({ transport: http(RPC) });
  const accumulator = getAddress(ACCUMULATOR);
  const vault = getAddress(VAULT);

  const pending = await publicClient.readContract({ address: accumulator, abi: accumulatorAbi, functionName: "pendingEth" });
  console.log(`[keeper] pending fees: ${formatEther(pending)} ETH`);
  if (pending < MIN) {
    console.log(`[keeper] below MIN_ACCUMULATE_ETH (${formatEther(MIN)}) — skip.`);
    return;
  }

  // Read the enabled basket + weights from the vault.
  const n = Number(await publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "assetCount" }));
  const basket = [];
  let totalWeight = 0n;
  for (let i = 0; i < n; i++) {
    const asset = await publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "assets", args: [BigInt(i)] });
    const cfg = await publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "assetConfig", args: [asset] });
    const [enabled, weightBps] = cfg;
    if (enabled && weightBps > 0) {
      basket.push({ asset, weight: BigInt(weightBps) });
      totalWeight += BigInt(weightBps);
    }
  }
  if (basket.length === 0 || totalWeight === 0n) {
    console.log("[keeper] no enabled reward assets configured — skip.");
    return;
  }

  if (!pk) {
    console.log(`[keeper] would convert ${formatEther(pending)} ETH across ${basket.length} assets (dry run).`);
    return;
  }
  const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
  const wallet = createWalletClient({ account, transport: http(RPC) });
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

  let converted = 0;
  for (const { asset, weight } of basket) {
    let share = (pending * weight) / totalWeight;
    if (share > MAX_PER) share = MAX_PER; // stay under the adapter's per-conversion cap
    if (share === 0n) continue;
    try {
      const hash = await wallet.writeContract({
        address: accumulator,
        abi: accumulatorAbi,
        functionName: "accumulate",
        args: [asset, share, 0n, deadline], // adapter enforces route slippage internally
      });
      console.log(`[keeper] accumulate ${asset} <- ${formatEther(share)} ETH  tx ${hash}`);
      await publicClient.waitForTransactionReceipt({ hash });
      converted++;
    } catch (e) {
      console.log(`[keeper] accumulate ${asset} failed (${String(e).slice(0, 80)}) — skip`);
    }
  }
  console.log(`[keeper] done — ${converted} conversion(s).`);
}

main().catch((e) => {
  console.error("[keeper] error:", e);
  process.exit(1);
});
