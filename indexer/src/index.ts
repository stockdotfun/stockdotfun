import { ponder } from "ponder:registry";
import {
  tokens,
  pools,
  trades,
  holders,
  conversions,
  claims,
  graduations,
  protocolMetrics,
} from "ponder:schema";

const ZERO = "0x0000000000000000000000000000000000000000";

async function bumpMetrics(
  context: { db: any },
  patch: (row: any) => Record<string, unknown>,
  init: Record<string, unknown>,
) {
  await context.db
    .insert(protocolMetrics)
    .values({ id: "global", ...init })
    .onConflictDoUpdate(patch);
}

ponder.on("Factory:TokenCreated", async ({ event, context }) => {
  const { token, pool, creator, stock, holderVault, name, symbol, metadataURI } = event.args;
  await context.db.insert(tokens).values({
    id: token,
    pool,
    name,
    symbol,
    metadataURI,
    creator,
    stock,
    createdAt: Number(event.block.timestamp),
    createdBlock: event.block.number,
    lifecycle: "ACTIVE",
  });
  await context.db.insert(pools).values({ id: pool, token, holderVault });
  await bumpMetrics(context, (r) => ({ totalTokens: r.totalTokens + 1 }), { totalTokens: 1 });
});

ponder.on("Pool:Buy", async ({ event, context }) => {
  const pool = await context.db.find(pools, { id: event.log.address });
  if (!pool) return;
  await context.db.insert(trades).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    token: pool.token,
    trader: event.args.buyer,
    side: "buy",
    quoteAmount: event.args.quoteIn,
    tokenAmount: event.args.tokensOut,
    fee: event.args.fee,
    timestamp: Number(event.block.timestamp),
    block: event.block.number,
  });
  await context.db.update(tokens, { id: pool.token }).set((r: any) => ({
    volumeQuote: r.volumeQuote + event.args.quoteIn,
    tradeCount: r.tradeCount + 1,
    realQuote: r.realQuote + (event.args.quoteIn - event.args.fee), // net principal added
  }));
  await bumpMetrics(context, (r) => ({ totalVolumeQuote: r.totalVolumeQuote + event.args.quoteIn }), {
    totalVolumeQuote: event.args.quoteIn,
  });
});

ponder.on("Pool:Sell", async ({ event, context }) => {
  const pool = await context.db.find(pools, { id: event.log.address });
  if (!pool) return;
  await context.db.insert(trades).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    token: pool.token,
    trader: event.args.seller,
    side: "sell",
    quoteAmount: event.args.quoteOut,
    tokenAmount: event.args.tokensIn,
    fee: event.args.fee,
    timestamp: Number(event.block.timestamp),
    block: event.block.number,
  });
  await context.db.update(tokens, { id: pool.token }).set((r: any) => {
    const removed = event.args.quoteOut + event.args.fee;
    return {
      volumeQuote: r.volumeQuote + event.args.quoteOut,
      tradeCount: r.tradeCount + 1,
      realQuote: r.realQuote > removed ? r.realQuote - removed : 0n,
    };
  });
});

ponder.on("Pool:GraduationReady", async ({ event, context }) => {
  const pool = await context.db.find(pools, { id: event.log.address });
  await context.db
    .insert(graduations)
    .values({
      id: event.log.address,
      token: pool?.token ?? ZERO,
      status: "ready",
      timestamp: Number(event.block.timestamp),
    })
    .onConflictDoUpdate({ status: "ready" });
  if (pool) await context.db.update(tokens, { id: pool.token }).set({ lifecycle: "READY_TO_GRADUATE" });
});

ponder.on("Pool:GraduationCompleted", async ({ event, context }) => {
  const pool = await context.db.find(pools, { id: event.log.address });
  await context.db
    .insert(graduations)
    .values({
      id: event.log.address,
      token: pool?.token ?? ZERO,
      status: "completed",
      uniswapPoolId: event.args.poolId,
      liquidity: event.args.liquidity,
      timestamp: Number(event.block.timestamp),
    })
    .onConflictDoUpdate({
      status: "completed",
      uniswapPoolId: event.args.poolId,
      liquidity: event.args.liquidity,
    });
  if (pool) {
    await context.db.update(tokens, { id: pool.token }).set({
      lifecycle: "GRADUATED",
      graduatedPoolId: event.args.poolId,
    });
  }
  await bumpMetrics(context, (r) => ({ totalGraduated: r.totalGraduated + 1 }), { totalGraduated: 1 });
});

ponder.on("Pool:GraduationFailed", async ({ event, context }) => {
  const pool = await context.db.find(pools, { id: event.log.address });
  if (pool) await context.db.update(tokens, { id: pool.token }).set({ lifecycle: "MIGRATION_FAILED" });
});

ponder.on("Treasury:Converted", async ({ event, context }) => {
  await context.db.insert(conversions).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    pool: event.args.pool,
    status: "completed",
    wethConverted: event.args.wethConverted,
    stockOut: event.args.stockOut,
    holderStock: event.args.holderStock,
    creatorStock: event.args.creatorStock,
    timestamp: Number(event.block.timestamp),
  });
});

ponder.on("Treasury:StockConversionFailed", async ({ event, context }) => {
  await context.db.insert(conversions).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    pool: event.args.pool,
    status: "failed",
    wethConverted: event.args.wethAttempted,
    timestamp: Number(event.block.timestamp),
  });
});

ponder.on("CreatorVault:RewardClaimed", async ({ event, context }) => {
  await context.db.insert(claims).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    vault: event.log.address,
    account: event.args.creator,
    asset: event.args.asset,
    amount: event.args.amount,
    kind: "creator",
    timestamp: Number(event.block.timestamp),
  });
});

ponder.on("HolderVault:RewardClaimed", async ({ event, context }) => {
  await context.db.insert(claims).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    vault: event.log.address,
    account: event.args.account,
    asset: event.args.asset,
    amount: event.args.amount,
    kind: "holder",
    timestamp: Number(event.block.timestamp),
  });
});

// Holder balances + counts from meme-token transfers.
ponder.on("MemeToken:Transfer", async ({ event, context }) => {
  const token = event.log.address;
  const { from, to, value } = event.args;
  if (from !== ZERO) await moveBalance(context, token, from, -value);
  if (to !== ZERO) await moveBalance(context, token, to, value);
});

async function moveBalance(context: { db: any }, token: string, account: string, delta: bigint) {
  const id = `${token}-${account}`;
  const existing = await context.db.find(holders, { id });
  const prev = existing?.balance ?? 0n;
  const next = prev + delta;
  if (!existing) {
    await context.db.insert(holders).values({ id, token, holder: account, balance: next });
  } else {
    await context.db.update(holders, { id }).set({ balance: next });
  }
  // maintain holderCount when crossing zero boundary
  const became = prev === 0n && next > 0n;
  const emptied = prev > 0n && next <= 0n;
  if (became || emptied) {
    const pool = await context.db.find(tokens, { id: token });
    if (pool) {
      await context.db
        .update(tokens, { id: token })
        .set((r: any) => ({ holderCount: r.holderCount + (became ? 1 : -1) }));
    }
  }
}
