/**
 * On-chain quotes for graduated Flap tokens via the migrated V2-fork router.
 * Uses getAmountsOut for the price and pool reserves for price impact.
 */
import { createPublicClient, http, getAddress } from "viem";
import { robinhoodChain } from "@/lib/chains/robinhood";
import flapConfig from "@/config/flap.robinhood.json";
import { getPoolInfo } from "./pools";

const WETH = getAddress(flapConfig.migration.weth);
const ROUTER = getAddress(flapConfig.migration.router);

const client = createPublicClient({
  chain: robinhoodChain,
  transport: http(process.env.INDEXER_RPC_URL ?? flapConfig.rpcUrl),
});

const routerAbi = [
  {
    type: "function",
    name: "getAmountsOut",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

export type FlapQuote = {
  amountIn: bigint;
  amountOut: bigint;
  /** amountOut with slippage tolerance applied (bps). */
  minOut: bigint;
  priceImpactBps: number;
  isBuy: boolean;
};

/**
 * Quote a buy (ETH in) or sell (token in). `slippageBps` default 100 (1%).
 * Returns null if the router can't quote (e.g. no liquidity).
 */
export async function quoteFlapTrade(
  token: string,
  pool: string,
  amountIn: bigint,
  isBuy: boolean,
  slippageBps = 100,
): Promise<FlapQuote | null> {
  if (amountIn <= 0n) return null;
  const t = getAddress(token);
  const path = isBuy ? [WETH, t] : [t, WETH];
  try {
    const amounts = (await client.readContract({
      address: ROUTER,
      abi: routerAbi,
      functionName: "getAmountsOut",
      args: [amountIn, path],
    })) as bigint[];
    const amountOut = amounts[amounts.length - 1];
    const minOut = (amountOut * BigInt(10_000 - slippageBps)) / 10_000n;

    // Price impact vs the pool's marginal spot price (ideal fill with no slippage).
    let priceImpactBps = 0;
    const info = await getPoolInfo(t, pool);
    if (info) {
      const idealOut = isBuy
        ? (Number(amountIn) * Number(info.reserveToken)) / Number(info.reserveWeth)
        : (Number(amountIn) * Number(info.reserveWeth)) / Number(info.reserveToken);
      if (idealOut > 0) {
        priceImpactBps = Math.max(0, Math.round((1 - Number(amountOut) / idealOut) * 10_000));
      }
    }
    return { amountIn, amountOut, minOut, priceImpactBps, isBuy };
  } catch {
    return null;
  }
}
