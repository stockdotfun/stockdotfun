import { createPublicClient, http } from "viem";
import { robinhoodChain } from "@/lib/chains/robinhood";
import flapConfig from "@/config/flap.robinhood.json";
import { flapEnabled, FLAP } from "@/lib/integrations/flap/portal";
import { graduationCount } from "@/lib/integrations/flap/graduations";

export const revalidate = 30;

/** Integration health: honest status of the Flap integration + chain reachability. */
export async function GET() {
  const client = createPublicClient({
    chain: robinhoodChain,
    transport: http(process.env.INDEXER_RPC_URL ?? flapConfig.rpcUrl),
  });

  let latestBlock: number | null = null;
  let portalReachable = false;
  let graduations: number | null = null;
  try {
    const [head, code] = await Promise.all([
      client.getBlockNumber(),
      client.getCode({ address: FLAP.portal }),
    ]);
    latestBlock = Number(head);
    portalReachable = !!code && code !== "0x";
    graduations = await graduationCount().catch(() => null);
  } catch {
    /* leave nulls */
  }

  return Response.json({
    integrationEnabled: flapEnabled,
    tradingGatewayConfigured: !!process.env.NEXT_PUBLIC_EXTERNAL_TRADE_GATEWAY_ADDRESS,
    rewardCampaign: "paused", // honest default until funded + randomness set
    portal: FLAP.portal,
    portalReachable,
    deploymentBlock: Number(FLAP.deploymentBlock),
    latestBlock,
    graduationsAllTime: graduations,
    chainId: flapConfig.chainId,
    verifiedAt: flapConfig.verifiedAt,
  });
}
