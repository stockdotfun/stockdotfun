import { onchainTable, index } from "ponder";

/** Launched meme tokens (one per StockDotFunFactoryV2.createToken). */
export const tokens = onchainTable(
  "tokens",
  (t) => ({
    id: t.hex().primaryKey(), // token address
    pool: t.hex().notNull(),
    name: t.text().notNull(),
    symbol: t.text().notNull(),
    metadataURI: t.text().notNull(),
    creator: t.hex().notNull(),
    stock: t.hex().notNull(),
    createdAt: t.integer().notNull(),
    createdBlock: t.bigint().notNull(),
    lifecycle: t.text().notNull().default("ACTIVE"), // PoolLifecycle
    realQuote: t.bigint().notNull().default(0n),
    graduatedPoolId: t.hex(),
    volumeQuote: t.bigint().notNull().default(0n),
    tradeCount: t.integer().notNull().default(0),
    holderCount: t.integer().notNull().default(0),
  }),
  (table) => ({
    creatorIdx: index().on(table.creator),
    stockIdx: index().on(table.stock),
    lifecycleIdx: index().on(table.lifecycle),
  }),
);

/** Reverse lookup: pool address -> token address (+ holder vault). */
export const pools = onchainTable("pools", (t) => ({
  id: t.hex().primaryKey(), // pool address
  token: t.hex().notNull(),
  holderVault: t.hex().notNull(),
}));

/** Every buy/sell on a bonding curve. */
export const trades = onchainTable(
  "trades",
  (t) => ({
    id: t.text().primaryKey(), // txHash-logIndex
    token: t.hex().notNull(),
    trader: t.hex().notNull(),
    side: t.text().notNull(), // buy | sell
    quoteAmount: t.bigint().notNull(),
    tokenAmount: t.bigint().notNull(),
    fee: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
    block: t.bigint().notNull(),
  }),
  (table) => ({
    tokenIdx: index().on(table.token),
    traderIdx: index().on(table.trader),
  }),
);

/** Per-(token, holder) meme-token balance for holder counts / lists. */
export const holders = onchainTable(
  "holders",
  (t) => ({
    id: t.text().primaryKey(), // token-holder
    token: t.hex().notNull(),
    holder: t.hex().notNull(),
    balance: t.bigint().notNull().default(0n),
  }),
  (table) => ({
    tokenIdx: index().on(table.token),
    holderIdx: index().on(table.holder),
  }),
);

/** Stock reward conversion attempts (async batches). */
export const conversions = onchainTable("conversions", (t) => ({
  id: t.text().primaryKey(), // txHash-logIndex
  pool: t.hex().notNull(),
  status: t.text().notNull(), // completed | failed
  wethConverted: t.bigint().notNull().default(0n),
  stockOut: t.bigint().notNull().default(0n),
  holderStock: t.bigint().notNull().default(0n),
  creatorStock: t.bigint().notNull().default(0n),
  timestamp: t.integer().notNull(),
}));

/** Reward claims (holder + creator). */
export const claims = onchainTable("claims", (t) => ({
  id: t.text().primaryKey(),
  vault: t.hex().notNull(),
  account: t.hex().notNull(),
  asset: t.hex().notNull(),
  amount: t.bigint().notNull(),
  kind: t.text().notNull(), // holder | creator
  timestamp: t.integer().notNull(),
}));

/** Graduation events + resulting locked Uniswap position. */
export const graduations = onchainTable("graduations", (t) => ({
  id: t.hex().primaryKey(), // pool address
  token: t.hex(),
  status: t.text().notNull(), // ready | completed | failed
  uniswapPoolId: t.hex(),
  liquidity: t.bigint(),
  timestamp: t.integer().notNull(),
}));

/** Singleton protocol metrics row (id = "global"). */
export const protocolMetrics = onchainTable("protocol_metrics", (t) => ({
  id: t.text().primaryKey(),
  totalTokens: t.integer().notNull().default(0),
  totalGraduated: t.integer().notNull().default(0),
  totalVolumeQuote: t.bigint().notNull().default(0n),
}));
