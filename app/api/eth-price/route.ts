/**
 * GET /api/eth-price — current ETH/USD spot, used to show token market caps in
 * USD. WETH on Robinhood Chain is wrapped ether, so ETH/USD applies. Fetched
 * server-side (no client CORS / rate-limit exposure) and cached ~60s. Tries
 * CoinGecko, falls back to Coinbase; returns 503 if both are unavailable.
 */
export const revalidate = 60;

async function coingecko(): Promise<number | null> {
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { next: { revalidate: 60 } },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { ethereum?: { usd?: number } };
    const v = j?.ethereum?.usd;
    return typeof v === "number" && v > 0 ? v : null;
  } catch {
    return null;
  }
}

async function coinbase(): Promise<number | null> {
  try {
    const r = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", {
      next: { revalidate: 60 },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: { amount?: string } };
    const v = parseFloat(j?.data?.amount ?? "");
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export async function GET(): Promise<Response> {
  const usd = (await coingecko()) ?? (await coinbase());
  if (usd === null) {
    return Response.json({ usd: null, error: "unavailable" }, { status: 503 });
  }
  return Response.json({ usd });
}
