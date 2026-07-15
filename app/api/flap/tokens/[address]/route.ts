import { isAddress } from "viem";
import { getFlapTokenState, resolveGraduation } from "@/lib/integrations/flap/portal";
import { getPoolInfo } from "@/lib/integrations/flap/pools";
import { FlapTokenStatus } from "@/lib/integrations/flap/types";

export const revalidate = 30;

/** Honest on-chain state for a single Flap token (bonding curve or graduated). */
export async function GET(_req: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) return Response.json({ error: "invalid address" }, { status: 400 });

  const state = await getFlapTokenState(address);
  if (!state) {
    // Portal reverts for non-Flap tokens — report honestly, never guess.
    return Response.json({ isFlapToken: false }, { status: 404 });
  }

  const graduated = state.status === FlapTokenStatus.DEX;
  const verifiedGraduation = graduated ? await resolveGraduation(address) : null;
  const pool = verifiedGraduation ? await getPoolInfo(address, verifiedGraduation.pool) : null;

  return Response.json({
    isFlapToken: true,
    token: address,
    status: FlapTokenStatus[state.status],
    graduated,
    verifiedGraduated: !!verifiedGraduation,
    progress: Number(state.progress) / 1e18,
    quoteToken: state.quoteTokenAddress,
    taxBps: Number(state.taxRate),
    pool: verifiedGraduation?.pool ?? null,
    liquidityWeth: pool?.liquidityWeth ?? null,
    priceEthPerToken: pool?.priceEthPerToken ?? null,
    // trading through StockDotFun requires the token to be listed in the on-chain
    // registry AND the gateway to be deployed — honest gate:
    tradableThroughStockDotFun: false,
  });
}
