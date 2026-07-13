import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";

const app = new Hono();

const GRAD_TARGET = BigInt(process.env.GRADUATION_TARGET_WEI ?? "4400000000000000000"); // 4.4e18

// stock address -> ticker (the 8 verified assets)
const STOCK_SYMBOLS: Record<string, string> = {
  "0xaf3d76f1834a1d425780943c99ea8a608f8a93f9": "AAPL",
  "0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3": "GOOGL",
  "0xc0d6457c16cc70d6790dd43521c899c87ce02f35": "META",
  "0xff080c8ce2e5feadaca0da81314ae59d232d4afd": "MU",
  "0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec": "NVDA",
  "0x4a0e65a3eccec6dbe60ae065f2e7bb85fae35eea": "SPCX",
  "0x322f0929c4625ed5bad873c95208d54e1c003b2d": "TSLA",
  "0x117cc2133c37b721f49de2a7a74833232b3b4c0c": "SPY",
};

// Curve constants (StockDotFunFactoryV2 uses fixed params for every launch):
// constant-product with virtual reserves — price = (vq + realQuote)^2 / K.
const VQ = 3; // virtualQuote (ETH)
const VT = 73_000_000; // virtualToken (tokens)
const SUPPLY = 1_000_000_000; // curve supply (tokens)
const K = VQ * (VT + SUPPLY);
const HOLDER_SHARE = 0.4; // 40% of the 1% trade fee routes to holders

/** Live market cap in ETH from realQuote (matches pool.terminalPrice). */
function mcapEth(realQuote: bigint): number {
  const rq = Number(realQuote) / 1e18;
  return ((VQ + rq) ** 2 / K) * SUPPLY;
}

type TokenStats = { volume24hEth: number; holderRewardsEth: number };

/** One pass over trades → per-token 24h volume + lifetime holder-share fees. */
async function tradeStats(): Promise<Map<string, TokenStats>> {
  const cutoff = Math.floor(Date.now() / 1000) - 86_400;
  const rows = await db.select().from(schema.trades);
  const map = new Map<string, TokenStats>();
  for (const r of rows) {
    const key = (r.token as string).toLowerCase();
    const s = map.get(key) ?? { volume24hEth: 0, holderRewardsEth: 0 };
    if (r.timestamp >= cutoff) s.volume24hEth += Number(r.quoteAmount) / 1e18;
    s.holderRewardsEth += (Number(r.fee) / 1e18) * HOLDER_SHARE;
    map.set(key, s);
  }
  return map;
}

function toDto(row: any, stats?: TokenStats) {
  // Fractional percent (4-decimal resolution) so small-but-real progress isn't
  // floored to 0 by integer division — e.g. 0.0008 ETH of a 4.4 ETH target = 0.02%.
  const progress =
    row.lifecycle === "GRADUATED"
      ? 100
      : Math.min(
          100,
          Number((row.realQuote * 1_000_000n) / (GRAD_TARGET === 0n ? 1n : GRAD_TARGET)) / 10_000,
        );
  return {
    address: row.id,
    pool: row.pool,
    name: row.name,
    symbol: row.symbol,
    creator: row.creator,
    stockSymbol: STOCK_SYMBOLS[(row.stock as string).toLowerCase()] ?? row.stock,
    createdAt: row.createdAt,
    status: row.lifecycle === "GRADUATED" ? "graduated" : "curve",
    lifecycle: row.lifecycle,
    curveProgress: progress,
    holderCount: row.holderCount,
    tradeCount: row.tradeCount,
    // ipfs:// URI of the metadata JSON (holds name/description/image); the
    // client fetches it to render the launch image.
    metadataURI: row.metadataURI,
    // ETH-denominated stats (no USD oracle here — the client converts):
    marketCapEth: mcapEth(row.realQuote),
    volume24hEth: stats?.volume24hEth ?? 0,
    holderRewardsEth: stats?.holderRewardsEth ?? 0,
  };
}

// Ponder serves /health and /ready internally; we expose app data below.
app.get("/tokens", async (c) => {
  const stock = c.req.query("stock");
  const [rows, stats] = await Promise.all([
    db.select().from(schema.tokens).orderBy(desc(schema.tokens.createdAt)).limit(200),
    tradeStats(),
  ]);
  let out = rows.map((r) => toDto(r, stats.get((r.id as string).toLowerCase())));
  if (stock) out = out.filter((t) => t.stockSymbol === stock);
  const search = c.req.query("search")?.toLowerCase();
  if (search) out = out.filter((t) => t.name.toLowerCase().includes(search) || t.symbol.toLowerCase().includes(search));
  const sort = c.req.query("sort");
  if (sort === "volume") out.sort((a, b) => b.tradeCount - a.tradeCount);
  else if (sort === "holders") out.sort((a, b) => b.holderCount - a.holderCount);
  return c.json(out);
});

app.get("/tokens/:address", async (c) => {
  const [rows, stats] = await Promise.all([
    db
      .select()
      .from(schema.tokens)
      .where(eq(schema.tokens.id, c.req.param("address") as `0x${string}`))
      .limit(1),
    tradeStats(),
  ]);
  if (rows.length === 0) return c.json(null, 404);
  return c.json(toDto(rows[0], stats.get((rows[0].id as string).toLowerCase())));
});

app.get("/tokens/:address/trades", async (c) => {
  const rows = await db
    .select()
    .from(schema.trades)
    .where(eq(schema.trades.token, c.req.param("address") as `0x${string}`))
    .orderBy(desc(schema.trades.timestamp))
    .limit(100);
  return c.json(
    rows.map((r) => ({
      id: r.id,
      side: r.side,
      trader: r.trader,
      quoteAmount: r.quoteAmount.toString(),
      tokenAmount: r.tokenAmount.toString(),
      timestamp: r.timestamp,
    })),
  );
});

app.get("/tokens/:address/holders", async (c) => {
  const rows = await db
    .select()
    .from(schema.holders)
    .where(eq(schema.holders.token, c.req.param("address") as `0x${string}`))
    .limit(500);
  const nonZero = rows
    .filter((r) => r.balance > 0n)
    .sort((a, b) => (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0))
    .slice(0, 50);
  return c.json(
    nonZero.map((r) => ({ holder: r.holder, balance: r.balance.toString() })),
  );
});

app.get("/creators/:creator/tokens", async (c) => {
  const rows = await db
    .select()
    .from(schema.tokens)
    .where(eq(schema.tokens.creator, c.req.param("creator") as `0x${string}`))
    .orderBy(desc(schema.tokens.createdAt));
  return c.json(rows.map((r) => toDto(r)));
});

app.get("/stats", async (c) => {
  const rows = await db.select().from(schema.protocolMetrics).where(eq(schema.protocolMetrics.id, "global")).limit(1);
  const r = rows[0];
  if (!r) return c.json({ totalTokens: 0, totalGraduated: 0, totalVolumeQuote: "0" });
  // protocolMetrics has bigint columns; JSON cannot serialize BigInt directly.
  return c.json({
    totalTokens: Number(r.totalTokens ?? 0),
    totalGraduated: Number(r.totalGraduated ?? 0),
    totalVolumeQuote: (r.totalVolumeQuote ?? 0n).toString(),
  });
});

export default app;
