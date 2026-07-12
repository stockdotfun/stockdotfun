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

function toDto(row: any) {
  const progress =
    row.lifecycle === "GRADUATED"
      ? 100
      : Math.min(100, Number((row.realQuote * 100n) / (GRAD_TARGET === 0n ? 1n : GRAD_TARGET)));
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
    // USD stats intentionally omitted: no price oracle wired yet.
  };
}

// Ponder serves /health and /ready internally; we expose app data below.
app.get("/tokens", async (c) => {
  const stock = c.req.query("stock");
  const rows = await db
    .select()
    .from(schema.tokens)
    .orderBy(desc(schema.tokens.createdAt))
    .limit(200);
  let out = rows.map(toDto);
  if (stock) out = out.filter((t) => t.stockSymbol === stock);
  const search = c.req.query("search")?.toLowerCase();
  if (search) out = out.filter((t) => t.name.toLowerCase().includes(search) || t.symbol.toLowerCase().includes(search));
  const sort = c.req.query("sort");
  if (sort === "volume") out.sort((a, b) => b.tradeCount - a.tradeCount);
  else if (sort === "holders") out.sort((a, b) => b.holderCount - a.holderCount);
  return c.json(out);
});

app.get("/tokens/:address", async (c) => {
  const rows = await db
    .select()
    .from(schema.tokens)
    .where(eq(schema.tokens.id, c.req.param("address") as `0x${string}`))
    .limit(1);
  if (rows.length === 0) return c.json(null, 404);
  return c.json(toDto(rows[0]));
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

app.get("/creators/:creator/tokens", async (c) => {
  const rows = await db
    .select()
    .from(schema.tokens)
    .where(eq(schema.tokens.creator, c.req.param("creator") as `0x${string}`))
    .orderBy(desc(schema.tokens.createdAt));
  return c.json(rows.map(toDto));
});

app.get("/stats", async (c) => {
  const rows = await db.select().from(schema.protocolMetrics).where(eq(schema.protocolMetrics.id, "global")).limit(1);
  return c.json(rows[0] ?? { totalTokens: 0, totalGraduated: 0, totalVolumeQuote: "0" });
});

export default app;
