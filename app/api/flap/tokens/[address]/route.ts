import { isAddress, createPublicClient, http, getAddress } from "viem";
import { robinhoodChain } from "@/lib/chains/robinhood";
import flapConfig from "@/config/flap.robinhood.json";
import { getFlapTokenState, resolveGraduation } from "@/lib/integrations/flap/portal";
import { getPoolInfo } from "@/lib/integrations/flap/pools";
import { FlapTokenStatus } from "@/lib/integrations/flap/types";

export const revalidate = 30;

const erc20Abi = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

/** Honest on-chain state for a single Flap token (bonding curve or graduated). */
export async function GET(_req: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) return Response.json({ error: "invalid address" }, { status: 400 });

  const client = createPublicClient({
    chain: robinhoodChain,
    transport: http(process.env.INDEXER_RPC_URL ?? flapConfig.rpcUrl),
  });
  const [symbol, name] = await Promise.all([
    client.readContract({ address: getAddress(address), abi: erc20Abi, functionName: "symbol" }).catch(() => ""),
    client.readContract({ address: getAddress(address), abi: erc20Abi, functionName: "name" }).catch(() => ""),
  ]);

  const state = await getFlapTokenState(address);
  if (!state) {
    // Portal reverts for non-Flap tokens — report honestly, never guess.
    return Response.json({ isFlapToken: false }, { status: 404 });
  }

  const graduated = state.status === FlapTokenStatus.DEX;
  const verifiedGraduation = graduated ? await resolveGraduation(address) : null;
  const pool = verifiedGraduation ? await getPoolInfo(address, verifiedGraduation.pool) : null;

  // Honest tradability: is the token listed + enabled in the live gateway registry?
  let tradable = false;
  const registryAddr = process.env.NEXT_PUBLIC_FLAP_DEX_ADAPTER_REGISTRY_ADDRESS;
  if (registryAddr && isAddress(registryAddr)) {
    tradable = (await client
      .readContract({
        address: getAddress(registryAddr),
        abi: [{ type: "function", name: "isTradable", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] }],
        functionName: "isTradable",
        args: [getAddress(address)],
      })
      .catch(() => false)) as boolean;
  }

  return Response.json({
    isFlapToken: true,
    token: address,
    symbol: symbol as string,
    name: name as string,
    status: FlapTokenStatus[state.status],
    graduated,
    verifiedGraduated: !!verifiedGraduation,
    progress: Number(state.progress) / 1e18,
    quoteToken: state.quoteTokenAddress,
    taxBps: Number(state.taxRate),
    pool: verifiedGraduation?.pool ?? null,
    liquidityWeth: pool?.liquidityWeth ?? null,
    priceEthPerToken: pool?.priceEthPerToken ?? null,
    // trading through StockDotFun requires the token to be listed + enabled in
    // the on-chain gateway registry — read live, never assumed:
    tradableThroughStockDotFun: tradable,
  });
}
