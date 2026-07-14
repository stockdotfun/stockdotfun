/**
 * External indexer client (Part 9). Talks to the Ponder API at
 * NEXT_PUBLIC_INDEXER_URL. On any error or missing data it returns empty
 * results — it never fabricates stats. Fields the indexer cannot yet provide
 * (e.g. USD prices without an oracle) are left undefined.
 */
import { formatEther } from "viem";
import type { LaunchedToken, TokenTrade, TradeSide } from "@/types/token";
import type { ExploreQuery, IndexerClient } from "@/lib/indexer/types";
import { isHiddenToken } from "@/lib/indexer/hidden";

const BASE = process.env.NEXT_PUBLIC_INDEXER_URL?.replace(/\/$/, "") ?? "";

export const indexerApiConfigured = BASE.length > 0;

async function get<T>(path: string): Promise<T | null> {
  if (!indexerApiConfigured) return null;
  try {
    const res = await fetch(`${BASE}${path}`, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type ApiToken = Partial<LaunchedToken> & {
  address: string;
  pool: string;
  holderRewardsEth?: number;
};

function mapToken(t: ApiToken): LaunchedToken {
  return {
    address: t.address as `0x${string}`,
    pool: t.pool as `0x${string}`,
    name: t.name ?? "",
    symbol: t.symbol ?? "",
    description: t.description,
    imageUrl: t.imageUrl,
    metadataURI: t.metadataURI,
    creator: (t.creator ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    stockSymbol: t.stockSymbol ?? "",
    creatorRewardPreference: t.creatorRewardPreference ?? "stock", // V2 pays creators in the paired stock
    createdAt: t.createdAt ?? 0,
    status: t.status ?? "curve",
    curveProgress: t.curveProgress ?? 0,
    priceUsd: t.priceUsd,
    marketCapUsd: t.marketCapUsd,
    volume24hUsd: t.volume24hUsd,
    marketCapEth: t.marketCapEth,
    volume24hEth: t.volume24hEth,
    holderRewardPoolEth: t.holderRewardsEth,
    holderCount: t.holderCount,
    holderRewardPoolUsd: t.holderRewardPoolUsd,
    creatorRewardsUsd: t.creatorRewardsUsd,
  };
}

export const externalClient: IndexerClient = {
  source: "external",
  async getTokens(query: ExploreQuery) {
    const params = new URLSearchParams();
    if (query.search) params.set("search", query.search);
    if (query.filter) params.set("filter", query.filter);
    if (query.stockSymbol) params.set("stock", query.stockSymbol);
    if (query.sort) params.set("sort", query.sort);
    const data = await get<ApiToken[]>(`/tokens?${params.toString()}`);
    return (data ?? []).map(mapToken);
  },
  async getToken(address: string) {
    const data = await get<ApiToken>(`/tokens/${address}`);
    return data ? mapToken(data) : null;
  },
  async getTrades(tokenAddress: string) {
    // The indexer returns raw on-chain amounts (wei); there is no USD oracle
    // wired, so we surface real ETH values. Shape:
    // { id, side, trader, quoteAmount, tokenAmount, timestamp }.
    type ApiTrade = {
      id: string;
      side: string;
      trader: string;
      quoteAmount: string;
      tokenAmount: string;
      timestamp: number;
    };
    const data = await get<ApiTrade[]>(`/tokens/${tokenAddress}/trades`);
    return (data ?? []).map<TokenTrade>((t) => ({
      txHash: t.id.split("-")[0],
      side: (t.side === "sell" ? "sell" : "buy") as TradeSide,
      account: t.trader as `0x${string}`,
      quoteAmountEth: Number(formatEther(BigInt(t.quoteAmount))),
      tokenAmount: Number(formatEther(BigInt(t.tokenAmount))),
      timestamp: t.timestamp,
    }));
  },
  async getTokensByCreator(creator: string) {
    const data = await get<ApiToken[]>(`/creators/${creator}/tokens`);
    return (data ?? []).map(mapToken).filter((t) => !isHiddenToken(t.address));
  },
};
