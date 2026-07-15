/**
 * Flap Portal read layer (server-side). Talks to the VERIFIED Flap Portal on
 * Robinhood Chain and returns honest, on-chain token state. Never invents
 * graduation — a token is only "graduated" when the Portal reports status=DEX
 * AND its pool verifies (see resolveGraduation).
 *
 * Verified deployment: config/flap.robinhood.json.
 */
import { createPublicClient, http, getAddress, zeroAddress } from "viem";
import { robinhoodChain } from "@/lib/chains/robinhood";
import flapConfig from "@/config/flap.robinhood.json";
import { FlapTokenStatus, type FlapTokenStateV7, type VerifiedFlapGraduation } from "./types";

/** The integration is inert unless explicitly enabled after verification. */
export const flapEnabled = process.env.FLAP_INTEGRATION_ENABLED === "true";

export const FLAP = {
  portal: getAddress(process.env.FLAP_ROBINHOOD_PORTAL_ADDRESS ?? flapConfig.portal.address),
  deploymentBlock: BigInt(
    process.env.FLAP_ROBINHOOD_DEPLOYMENT_BLOCK ?? flapConfig.portal.deploymentBlock,
  ),
  weth: getAddress(flapConfig.migration.weth),
  factory: getAddress(flapConfig.migration.factory),
} as const;

const client = createPublicClient({
  chain: robinhoodChain,
  transport: http(process.env.INDEXER_RPC_URL ?? flapConfig.rpcUrl),
});

const getTokenV7Abi = [
  {
    type: "function",
    name: "getTokenV7",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "status", type: "uint8" },
          { name: "reserve", type: "uint256" },
          { name: "circulatingSupply", type: "uint256" },
          { name: "price", type: "uint256" },
          { name: "tokenVersion", type: "uint8" },
          { name: "r", type: "uint256" },
          { name: "h", type: "uint256" },
          { name: "k", type: "uint256" },
          { name: "dexSupplyThresh", type: "uint256" },
          { name: "quoteTokenAddress", type: "address" },
          { name: "nativeToQuoteSwapEnabled", type: "bool" },
          { name: "extensionID", type: "bytes32" },
          { name: "taxRate", type: "uint256" },
          { name: "pool", type: "address" },
          { name: "progress", type: "uint256" },
          { name: "lpFeeProfile", type: "uint8" },
          { name: "dexId", type: "uint8" },
        ],
      },
    ],
  },
] as const;

const pairAbi = [
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "token1", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "factory", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
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

/**
 * Read a token's Portal state. Returns null if the Portal doesn't recognize the
 * token (it reverts for non-Flap tokens) — that is the honest "not a Flap token"
 * answer, never a fabricated status.
 */
export async function getFlapTokenState(token: string): Promise<FlapTokenStateV7 | null> {
  try {
    const s = (await client.readContract({
      address: FLAP.portal,
      abi: getTokenV7Abi,
      functionName: "getTokenV7",
      args: [getAddress(token)],
    })) as unknown as Record<string, unknown>;
    return {
      status: Number(s.status) as FlapTokenStatus,
      reserve: s.reserve as bigint,
      circulatingSupply: s.circulatingSupply as bigint,
      price: s.price as bigint,
      tokenVersion: Number(s.tokenVersion),
      r: s.r as bigint,
      h: s.h as bigint,
      k: s.k as bigint,
      dexSupplyThresh: s.dexSupplyThresh as bigint,
      quoteTokenAddress: s.quoteTokenAddress as `0x${string}`,
      nativeToQuoteSwapEnabled: s.nativeToQuoteSwapEnabled as boolean,
      extensionID: s.extensionID as `0x${string}`,
      taxRate: s.taxRate as bigint,
      pool: s.pool as `0x${string}`,
      progress: s.progress as bigint,
      lpFeeProfile: Number(s.lpFeeProfile),
      dexId: Number(s.dexId),
    };
  } catch {
    return null; // not a Flap token, or RPC failure — caller treats as "unknown"
  }
}

/** True only when the Portal itself reports status = DEX (graduated). */
export function isGraduatedStatus(state: FlapTokenStateV7 | null): boolean {
  return !!state && state.status === FlapTokenStatus.DEX && state.pool !== zeroAddress;
}

/**
 * Prove a graduation on-chain: the Portal must report DEX + a nonzero pool, and
 * the pool must be a real pair that (a) has bytecode, (b) pairs the token with
 * WETH, (c) belongs to the approved V2-fork factory, and (d) holds liquidity.
 * Returns null unless ALL checks pass — never a partial/optimistic result.
 */
export async function resolveGraduation(token: string): Promise<VerifiedFlapGraduation | null> {
  const t = getAddress(token);
  const state = await getFlapTokenState(t);
  if (!isGraduatedStatus(state)) return null;
  const pool = getAddress(state!.pool);

  try {
    const code = await client.getCode({ address: pool });
    if (!code || code === "0x") return null; // pool has no bytecode

    const [token0, token1, factory, reserves] = await Promise.all([
      client.readContract({ address: pool, abi: pairAbi, functionName: "token0" }),
      client.readContract({ address: pool, abi: pairAbi, functionName: "token1" }),
      client.readContract({ address: pool, abi: pairAbi, functionName: "factory" }),
      client.readContract({ address: pool, abi: pairAbi, functionName: "getReserves" }),
    ]);

    const t0 = getAddress(token0 as string);
    const t1 = getAddress(token1 as string);
    // pool must pair the Flap token with WETH
    const pairsToken = t0 === t || t1 === t;
    const pairsWeth = t0 === FLAP.weth || t1 === FLAP.weth;
    if (!pairsToken || !pairsWeth) return null;
    // approved DEX (the verified V2-fork factory)
    if (getAddress(factory as string) !== FLAP.factory) return null;

    const [r0, r1] = reserves as [bigint, bigint, number];
    const wethIsToken0 = t0 === FLAP.weth;
    const reserveWeth = wethIsToken0 ? r0 : r1;
    const reserveToken = wethIsToken0 ? r1 : r0;
    if (reserveWeth === 0n || reserveToken === 0n) return null; // no liquidity

    const tax = Number(state!.taxRate);
    return {
      token: t,
      pool,
      factory: FLAP.factory,
      quoteToken: zeroAddress,
      reserveWeth,
      reserveToken,
      buyTaxBps: tax,
      sellTaxBps: tax,
    };
  } catch {
    return null;
  }
}
