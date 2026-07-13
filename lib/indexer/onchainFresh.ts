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
import { GRADUATION_TARGET_ETH, curveMcapEth } from "@/lib/curve/graduation";
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
      marketCapEth: curveMcapEth(Number(formatEther(realQuote as bigint))),
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
      marketCapEth: curveMcapEth(Number(formatEther(realQuote as bigint))),
    };
    cache.set(address.toLowerCase(), built);
    return built;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Live on-chain extras: spot price, recent trades, and minimal holders — so a
// coin page is fully populated the moment it's created, before the indexer
// has seen a single block of it.
// ---------------------------------------------------------------------------

import { parseAbiItem, type Log } from "viem";
import type { TokenTrade, TokenHolder } from "@/types/token";

const poolReadsAbi2 = [
  { type: "function", name: "terminalPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const erc20ReadsAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const buyEvent = parseAbiItem(
  "event Buy(address indexed buyer, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 refund)",
);
const sellEvent = parseAbiItem(
  "event Sell(address indexed seller, uint256 tokensIn, uint256 quoteOut, uint256 fee)",
);

const poolCache = new Map<string, `0x${string}`>();

async function poolFor(token: string): Promise<`0x${string}` | null> {
  const hit = poolCache.get(token.toLowerCase());
  if (hit) return hit;
  const factory = contractAddresses.factory;
  if (!factory) return null;
  try {
    const pool = (await client.readContract({
      address: factory,
      abi: factoryReadsAbi,
      functionName: "poolOf",
      args: [token as `0x${string}`],
    })) as `0x${string}`;
    if (!pool || pool === "0x0000000000000000000000000000000000000000") return null;
    poolCache.set(token.toLowerCase(), pool);
    return pool;
  } catch {
    return null;
  }
}

export type PoolSpot = { priceEth: number; mcapEth: number };

/** Live curve spot price / market cap straight from the pool (sub-second). */
export async function fetchPoolSpot(token: string): Promise<PoolSpot | null> {
  const pool = await poolFor(token);
  if (!pool) return null;
  try {
    const terminal = (await client.readContract({
      address: pool,
      abi: poolReadsAbi2,
      functionName: "terminalPrice",
    })) as bigint;
    const priceEth = Number(formatEther(terminal)); // ETH per token
    return { priceEth, mcapEth: priceEth * 1_000_000_000 };
  } catch {
    return null;
  }
}

// RHC produces ~10 blocks/sec; timestamps are approximated from block deltas
// (indexer data replaces them with exact values as it catches up).
const BLOCKS_PER_SEC = 10;
const TRADE_WINDOW = 30_000n; // per getLogs call
const TRADE_WINDOWS = 4; // total lookback ≈ 120k blocks ≈ 3.3h

/**
 * Recent Buy/Sell trades read directly from pool logs — instant, no indexer.
 * Covers roughly the last ~3 hours (fresh launches); older history comes from
 * the indexer, which supersedes these rows as it catches up.
 */
export async function fetchOnchainTrades(token: string): Promise<TokenTrade[]> {
  const pool = await poolFor(token);
  if (!pool) return [];
  try {
    const head = await client.getBlockNumber();
    const nowSec = Math.floor(Date.now() / 1000);
    const ranges = Array.from({ length: TRADE_WINDOWS }, (_, i) => {
      const to = head - TRADE_WINDOW * BigInt(i);
      const from = to - TRADE_WINDOW + 1n;
      return { from: from > 0n ? from : 0n, to };
    });
    const results = await Promise.all(
      ranges.map((r) =>
        client
          .getLogs({ address: pool, events: [buyEvent, sellEvent], fromBlock: r.from, toBlock: r.to })
          .catch(() => [] as Log[]),
      ),
    );
    const trades: TokenTrade[] = [];
    for (const logs of results) {
      for (const log of logs as (Log & { eventName: string; args: Record<string, unknown> })[]) {
        const ageSec = Number(head - (log.blockNumber ?? head)) / BLOCKS_PER_SEC;
        const timestamp = Math.max(0, Math.floor(nowSec - ageSec));
        if (log.eventName === "Buy") {
          trades.push({
            txHash: log.transactionHash ?? "",
            side: "buy",
            account: log.args.buyer as `0x${string}`,
            quoteAmountEth: Number(formatEther(log.args.quoteIn as bigint)),
            tokenAmount: Number(formatEther(log.args.tokensOut as bigint)),
            timestamp,
          });
        } else if (log.eventName === "Sell") {
          trades.push({
            txHash: log.transactionHash ?? "",
            side: "sell",
            account: log.args.seller as `0x${string}`,
            quoteAmountEth: Number(formatEther(log.args.quoteOut as bigint)),
            tokenAmount: Number(formatEther(log.args.tokensIn as bigint)),
            timestamp,
          });
        }
      }
    }
    trades.sort((a, b) => b.timestamp - a.timestamp);
    const top = trades.slice(0, 100);

    // Zap trades carry the zap contract as buyer/seller — attribute them to
    // the transaction's real sender.
    const zap = (contractAddresses.zap ?? "").toLowerCase();
    if (zap) {
      await Promise.all(
        top
          .filter((t) => t.account.toLowerCase() === zap && t.txHash)
          .map(async (t) => {
            try {
              const tx = await client.getTransaction({ hash: t.txHash as `0x${string}` });
              t.account = tx.from;
            } catch {
              // keep zap attribution on failure
            }
          }),
      );
    }
    return top;
  } catch {
    return [];
  }
}

/**
 * Minimal instant holders when the indexer has none yet: the bonding curve's
 * reserve plus the creator's balance (covers a fresh launch with a dev buy).
 */
export async function fetchOnchainHolders(
  token: string,
  creator?: string,
): Promise<TokenHolder[]> {
  const pool = await poolFor(token);
  if (!pool) return [];
  try {
    const addrs = [pool, ...(creator ? [creator as `0x${string}`] : [])];
    const balances = await Promise.all(
      addrs.map((a) =>
        client
          .readContract({ address: token as `0x${string}`, abi: erc20ReadsAbi, functionName: "balanceOf", args: [a] })
          .catch(() => 0n),
      ),
    );
    return addrs
      .map((a, i) => ({
        address: a,
        balance: Number(formatEther(balances[i] as bigint)),
        pct: (Number(formatEther(balances[i] as bigint)) / 1_000_000_000) * 100,
      }))
      .filter((h) => h.balance > 0)
      .sort((a, b) => b.balance - a.balance);
  } catch {
    return [];
  }
}
