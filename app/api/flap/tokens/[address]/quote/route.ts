import { isAddress, parseEther } from "viem";
import { resolveGraduation } from "@/lib/integrations/flap/portal";
import { quoteFlapTrade } from "@/lib/integrations/flap/quotes";

export const revalidate = 15;

/**
 * Quote a buy/sell of a graduated Flap token on its migrated pool.
 * Query: ?amountIn=<decimal>&side=buy|sell&slippageBps=100
 * Buy amountIn is in ETH; sell amountIn is in whole tokens (18-dec).
 */
export async function GET(req: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) return Response.json({ error: "invalid address" }, { status: 400 });

  const url = new URL(req.url);
  const side = url.searchParams.get("side") === "sell" ? "sell" : "buy";
  const amountStr = url.searchParams.get("amountIn") ?? "0";
  const slippageBps = Math.min(Math.max(Number(url.searchParams.get("slippageBps") ?? "100"), 1), 5000);

  let amountIn: bigint;
  try {
    amountIn = parseEther(amountStr);
  } catch {
    return Response.json({ error: "invalid amountIn" }, { status: 400 });
  }
  if (amountIn <= 0n) return Response.json({ error: "amountIn must be > 0" }, { status: 400 });

  // Only quote genuinely-graduated tokens (proven on-chain).
  const grad = await resolveGraduation(address);
  if (!grad) return Response.json({ error: "token not graduated / not verified" }, { status: 409 });

  const q = await quoteFlapTrade(address, grad.pool, amountIn, side === "buy", slippageBps);
  if (!q) return Response.json({ error: "no quote available" }, { status: 502 });

  return Response.json({
    token: address,
    pool: grad.pool,
    side,
    amountIn: amountIn.toString(),
    amountOut: q.amountOut.toString(),
    minOut: q.minOut.toString(),
    priceImpactBps: q.priceImpactBps,
    buyTaxBps: grad.buyTaxBps,
    sellTaxBps: grad.sellTaxBps,
    slippageBps,
  });
}
