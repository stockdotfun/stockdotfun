/**
 * Instant token visibility — direct on-chain freshness layer.
 *
 * The Ponder indexer can trail the chain head by minutes, so a just-launched
 * token wouldn't appear on Explore until it catches up. This module reads the
 * factory DIRECTLY over RPC (sub-second) and synthesizes LaunchedToken records
 * for any tokens the indexer doesn't have yet. The UI merges these in, so a new
 * launch is visible immediately — the indexer then backfills exact stats.
 *
 * Reads per missing token (parallel): factory.allTokens(i) + poolOf, token
 * name/symbol/metadataURI, treasury.pools(pool) (stock + creator), pool
 * realQuote (curve progress). Resolved tokens are cached module-level — their
 * identity fields are immutable.
 */
import { createPublicClient, http, formatEther } from "viem";
import { robinhoodChain } from "@/lib/chains/robinhood";
import { contractAddresses } from "@/lib/contracts/addresses";
import { GRADUATION_TARGET_ETH } from "@/lib/curve/graduation";
import { ALL_ASSETS } from "@/lib/assets/robinhoodAssets";
import type { LaunchedToken } from "@/types/token";

const STOCK_REWARD_TREASURY = (process.env.NEXT_PUBLIC_V2_STOCK_REWARD_TREASURY ??
  "0x284c47ef1754fa82b85cbe8207dd749e6f9ca389") as `0x${string}`;

const client = createPublicClient({
  chain: robinhoodChain,
  transport: http(process.env.NEXT_PUBLIC_RHC_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com"),
});

const factoryReadsAbi = [
  { type: "function", name: "allTokensLength", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allTokens", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "poolOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "address" }] },
] as const;

const tokenReadsAbi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "metadataURI", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

const poolReadsAbi = [
  { type: "function", name: "realQuote", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const treasuryReadsAbi = [
  {
    type: "function",
    name: "pools",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [
      { name: "registered", type: "bool" },
      { name: "stock", type: "address" },
      { name: "holderVault", type: "address" },
      { name: "creator", type: "address" },
      { name: "pendingHolderWeth", type: "uint256" },
      { name: "pendingCreatorWeth", type: "uint256" },
      { name: "pendingProtocolWeth", type: "uint256" },
      { name: "state", type: "uint8" },
    ],
  },
] as const;

function stockSymbolFor(address: string): string {
  const a = ALL_ASSETS.find((x) => x.address?.toLowerCase() === address.toLowerCase());
  return a?.symbol ?? "";
}

// Identity fields are immutable → cache resolved tokens forever (module scope).
const cache = new Map<string, LaunchedToken>();

async function readTokenAt(index: number): Promise<LaunchedToken | null> {
  const factory = contractAddresses.factory;
  if (!factory) return null;
  try {
    const token = (await client.readContract({
      address: factory,
      abi: factoryReadsAbi,
      functionName: "allTokens",
      args: [BigInt(index)],
    })) as `0x${string}`;

    const hit = cache.get(token.toLowerCase());
    if (hit) return hit;

    const pool = (await client.readContract({
      address: factory,
      abi: factoryReadsAbi,
      functionName: "poolOf",
      args: [token],
    })) as `0x${string}`;

    const [name, symbol, metadataURI, info, realQuote] = await Promise.all([
      client.readContract({ address: token, abi: tokenReadsAbi, functionName: "name" }),
      client.readContract({ address: token, abi: tokenReadsAbi, functionName: "symbol" }),
      client.readContract({ address: token, abi: tokenReadsAbi, functionName: "metadataURI" }),
      client.readContract({ address: STOCK_REWARD_TREASURY, abi: treasuryReadsAbi, functionName: "pools", args: [pool] }),
      client.readContract({ address: pool, abi: poolReadsAbi, functionName: "realQuote" }),
    ]);

    const progress = Math.min(
      100,
      (Number(formatEther(realQuote as bigint)) / GRADUATION_TARGET_ETH) * 100,
    );

    const built: LaunchedToken = {
      address: token,
      pool,
      name: name as string,
      symbol: symbol as string,
      metadataURI: metadataURI as string,
      creator: (info as readonly unknown[])[3] as `0x${string}`,
      stockSymbol: stockSymbolFor((info as readonly unknown[])[1] as string),
      creatorRewardPreference: "stock",
      // Exact creation time comes from the indexer once it catches up; "now" is
      // correct enough for a token discovered before the indexer has it.
      createdAt: Math.floor(Date.now() / 1000),
      status: "curve",
      curveProgress: progress,
    };
    cache.set(token.toLowerCase(), built);
    return built;
  } catch {
    return null;
  }
}

/** On-chain token count; null when unavailable (never throws). */
export async function onchainTokenCount(): Promise<number | null> {
  const factory = contractAddresses.factory;
  if (!factory) return null;
  try {
    const n = (await client.readContract({
      address: factory,
      abi: factoryReadsAbi,
      functionName: "allTokensLength",
    })) as bigint;
    return Number(n);
  } catch {
    return null;
  }
}

/**
 * Tokens the indexer doesn't have yet, newest first. `indexedCount` is how many
 * tokens the indexer returned; anything beyond that in the factory's append-only
 * allTokens array is fresh. Capped defensively.
 */
export async function fetchFreshTokens(indexedCount: number): Promise<LaunchedToken[]> {
  const total = await onchainTokenCount();
  if (total === null || total <= indexedCount) return [];
  const missing = Math.min(total - indexedCount, 20);
  const results = await Promise.all(
    Array.from({ length: missing }, (_, k) => readTokenAt(total - 1 - k)),
  );
  return results.filter((t): t is LaunchedToken => t !== null);
}

/** Direct on-chain lookup of a single token (token-page fallback). */
export async function fetchTokenOnchain(address: string): Promise<LaunchedToken | null> {
  const factory = contractAddresses.factory;
  if (!factory) return null;
  const hit = cache.get(address.toLowerCase());
  if (hit) return hit;
  try {
    const pool = (await client.readContract({
      address: factory,
      abi: factoryReadsAbi,
      functionName: "poolOf",
      args: [address as `0x${string}`],
    })) as `0x${string}`;
    if (!pool || pool === "0x0000000000000000000000000000000000000000") return null;

    const [name, symbol, metadataURI, info, realQuote] = await Promise.all([
      client.readContract({ address: address as `0x${string}`, abi: tokenReadsAbi, functionName: "name" }),
      client.readContract({ address: address as `0x${string}`, abi: tokenReadsAbi, functionName: "symbol" }),
      client.readContract({ address: address as `0x${string}`, abi: tokenReadsAbi, functionName: "metadataURI" }),
      client.readContract({ address: STOCK_REWARD_TREASURY, abi: treasuryReadsAbi, functionName: "pools", args: [pool] }),
      client.readContract({ address: pool, abi: poolReadsAbi, functionName: "realQuote" }),
    ]);

    const built: LaunchedToken = {
      address: address as `0x${string}`,
      pool,
      name: name as string,
      symbol: symbol as string,
      metadataURI: metadataURI as string,
      creator: (info as readonly unknown[])[3] as `0x${string}`,
      stockSymbol: stockSymbolFor((info as readonly unknown[])[1] as string),
      creatorRewardPreference: "stock",
      createdAt: Math.floor(Date.now() / 1000),
      status: "curve",
      curveProgress: Math.min(
        100,
        (Number(formatEther(realQuote as bigint)) / GRADUATION_TARGET_ETH) * 100,
      ),
    };
    cache.set(address.toLowerCase(), built);
    return built;
  } catch {
    return null;
  }
}
