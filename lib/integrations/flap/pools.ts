/**
 * Migrated DEX pool reads for graduated Flap tokens (Uniswap V2-fork pairs on
 * Robinhood Chain). Pure on-chain reads — reserves, price, liquidity.
 */
import { createPublicClient, http, getAddress } from "viem";
import { robinhoodChain } from "@/lib/chains/robinhood";
import flapConfig from "@/config/flap.robinhood.json";

const WETH = getAddress(flapConfig.migration.weth);

const client = createPublicClient({
  chain: robinhoodChain,
  transport: http(process.env.INDEXER_RPC_URL ?? flapConfig.rpcUrl),
});

const pairAbi = [
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "token1", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "reserve0", type: "uint112" },
      { name: "reserve1", type: "uint112" },
      { name: "blockTimestampLast", type: "uint32" },
    ],
  },
] as const;

export type FlapPoolInfo = {
  pool: `0x${string}`;
  token: `0x${string}`;
  reserveWeth: bigint;
  reserveToken: bigint;
  /** ETH per whole token (18-dec assumed). */
  priceEthPerToken: number;
  liquidityWeth: number;
};

/** Read reserves + spot price for a graduated token's V2 pool. Null on failure. */
export async function getPoolInfo(token: string, pool: string): Promise<FlapPoolInfo | null> {
  try {
    const p = getAddress(pool);
    const t = getAddress(token);
    const [token0, reserves] = await Promise.all([
      client.readContract({ address: p, abi: pairAbi, functionName: "token0" }),
      client.readContract({ address: p, abi: pairAbi, functionName: "getReserves" }),
    ]);
    const [r0, r1] = reserves as [bigint, bigint, number];
    const wethIsToken0 = getAddress(token0 as string) === WETH;
    const reserveWeth = wethIsToken0 ? r0 : r1;
    const reserveToken = wethIsToken0 ? r1 : r0;
    if (reserveWeth === 0n || reserveToken === 0n) return null;
    const priceEthPerToken = Number(reserveWeth) / Number(reserveToken);
    return {
      pool: p,
      token: t,
      reserveWeth,
      reserveToken,
      priceEthPerToken,
      liquidityWeth: Number(reserveWeth) / 1e18,
    };
  } catch {
    return null;
  }
}
