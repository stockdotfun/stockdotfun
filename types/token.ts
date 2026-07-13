export type CreatorRewardPreference = "eth" | "stock" | "split";

export type AssetType = "STOCK_TOKEN" | "ETF_TOKEN" | "BASE_TOKEN";

/** A supported tokenized asset from the canonical registry. */
export type StockAsset = {
  /** On-chain symbol() — source of truth for display. */
  symbol: string;
  /** Symbol as listed in Robinhood docs, when it differs from on-chain. */
  docsSymbol?: string;
  /** On-chain name(). */
  name: string;
  /** Short human label for UI. */
  displayName: string;
  /** Verified mainnet address — null only for unconfigured placeholders. */
  address: `0x${string}` | null;
  type: AssetType;
  /** Verified via on-chain decimals() read. */
  decimals: number;
  enabled: boolean;
  /** Price feed address — null until configured. */
  priceFeed: `0x${string}` | null;
  /** Provenance of the address. */
  source: "robinhood-docs";
  blockscoutUrl: string;
  /** e.g. "standard", "low-liquidity", "private-market" */
  riskLabel: string;
  /** Extra caution copy shown in the selector. */
  note?: string;
};

export type TokenStatus = "curve" | "graduated";

/** A launched meme token as surfaced on Explore / token pages. */
export type LaunchedToken = {
  address: `0x${string}`;
  pool: `0x${string}`;
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  /** ipfs:// URI of the metadata JSON; the client resolves the image from it. */
  metadataURI?: string;
  creator: `0x${string}`;
  stockSymbol: string;
  creatorRewardPreference: CreatorRewardPreference;
  createdAt: number;
  status: TokenStatus;
  /** 0-100 progress along the bonding curve toward graduation. */
  curveProgress: number;
  /** Stats — undefined when no indexer data exists (do not fabricate). */
  priceUsd?: number;
  marketCapUsd?: number;
  volume24hUsd?: number;
  holderCount?: number;
  holderRewardPoolUsd?: number;
  creatorRewardsUsd?: number;
  /** True when this record comes from the demo dataset. */
  isDemo?: boolean;
};

export type TradeSide = "buy" | "sell";

export type TokenTrade = {
  txHash: string;
  side: TradeSide;
  account: `0x${string}`;
  /** USD value — only available for demo data (no price oracle live yet). */
  quoteAmountUsd?: number;
  /** Real ETH quote amount from the indexer (buy: ETH in, sell: ETH out). */
  quoteAmountEth?: number;
  tokenAmount: number;
  timestamp: number;
  isDemo?: boolean;
};

export type FeeSplit = {
  /** Total launchpad fee in basis points of trade size. */
  totalBps: number;
  /** Shares of the fee (must sum to 10000). */
  holderShareBps: number;
  creatorShareBps: number;
  protocolShareBps: number;
};
