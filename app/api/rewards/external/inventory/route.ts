import { createPublicClient, http, isAddress, getAddress } from "viem";
import { robinhoodChain } from "@/lib/chains/robinhood";
import flapConfig from "@/config/flap.robinhood.json";

export const revalidate = 30;

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
  { type: "function", name: "available", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "isPayable", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
] as const;

const erc20Abi = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

/**
 * Real reward-vault inventory. Honest states:
 *  - vault not deployed  -> { campaign: "paused", assets: [] }
 *  - deployed            -> only assets ACTUALLY held + enabled, with live balances.
 * Never lists an unfunded or unsupported asset.
 */
export async function GET() {
  const vaultAddr = process.env.NEXT_PUBLIC_EXTERNAL_REWARD_VAULT_ADDRESS;
  if (!vaultAddr || !isAddress(vaultAddr)) {
    return Response.json({ campaign: "paused", reason: "reward vault not deployed", assets: [] });
  }
  const client = createPublicClient({
    chain: robinhoodChain,
    transport: http(process.env.INDEXER_RPC_URL ?? flapConfig.rpcUrl),
  });
  const vault = getAddress(vaultAddr);
  try {
    const count = Number(await client.readContract({ address: vault, abi: vaultAbi, functionName: "assetCount" }));
    const assets = await Promise.all(
      Array.from({ length: count }, async (_, i) => {
        const asset = (await client.readContract({
          address: vault,
          abi: vaultAbi,
          functionName: "assets",
          args: [BigInt(i)],
        })) as `0x${string}`;
        const [cfg, available, payable, symbol] = await Promise.all([
          client.readContract({ address: vault, abi: vaultAbi, functionName: "assetConfig", args: [asset] }),
          client.readContract({ address: vault, abi: vaultAbi, functionName: "available", args: [asset] }),
          client.readContract({ address: vault, abi: vaultAbi, functionName: "isPayable", args: [asset] }),
          client.readContract({ address: asset, abi: erc20Abi, functionName: "symbol" }).catch(() => "?"),
        ]);
        const [enabled, weightBps, lotSize] = cfg as [boolean, number, bigint, bigint, bigint];
        return {
          asset,
          symbol,
          enabled,
          weightBps: Number(weightBps),
          lotSize: (lotSize as bigint).toString(),
          available: (available as bigint).toString(),
          payable: payable as boolean,
        };
      }),
    );
    // Only surface assets that are actually payable (funded + enabled).
    const funded = assets.filter((a) => a.payable);
    return Response.json({ campaign: funded.length > 0 ? "active" : "paused", assets: funded });
  } catch {
    return Response.json({ campaign: "paused", reason: "vault read failed", assets: [] }, { status: 502 });
  }
}
