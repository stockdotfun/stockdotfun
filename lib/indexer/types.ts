import type { LaunchedToken, TokenTrade } from "@/types/token";

/** Events the indexer must eventually surface. */
export type IndexedEventName =
  | "TokenCreated"
  | "Buy"
  | "Sell"
  | "RewardClaimed"
  | "CreatorRewardClaimed"
  | "AssetSupportedUpdated";

export type ExploreQuery = {
  search?: string;
  filter?: "all" | "new" | "trending" | "rewards";
  stockSymbol?: string;
  sort?: "newest" | "volume" | "marketCap" | "rewards" | "holders";
};

/**
 * Contract all data backends implement. Implementations:
 *  - demo client (labeled demo data)
 *  - onchain fallback (direct contract reads, limited)
 *  - external indexer (subgraph / ponder / custom) — TODO when infra exists
 */
export interface IndexerClient {
  readonly source: "demo" | "onchain" | "external" | "none";
  getTokens(query: ExploreQuery): Promise<LaunchedToken[]>;
  getToken(address: string): Promise<LaunchedToken | null>;
  getTrades(tokenAddress: string): Promise<TokenTrade[]>;
  getTokensByCreator(creator: string): Promise<LaunchedToken[]>;
}
