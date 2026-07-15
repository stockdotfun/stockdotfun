/**
 * Discover graduated Flap tokens from the VERIFIED Portal's LaunchedToDEX logs
 * (source of truth), enriched with on-chain token + pool data. Server-side only.
 *
 * Uses the explorer log index for the historical range (a single eth_getLogs
 * over millions of blocks would be rejected). Every returned graduate is
 * additionally proven via resolveGraduation() before being marked verified.
 */
import { createPublicClient, http, getAddress } from "viem";
import { robinhoodChain } from "@/lib/chains/robinhood";
import flapConfig from "@/config/flap.robinhood.json";
import { getPoolInfo } from "./pools";
import { resolveGraduation } from "./portal";

const client = createPublicClient({
  chain: robinhoodChain,
  transport: http(process.env.INDEXER_RPC_URL ?? flapConfig.rpcUrl),
});

const erc20Abi = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

export type FlapGraduate = {
  token: `0x${string}`;
  pool: `0x${string}`;
  symbol: string;
  name: string;
  graduationBlock: number;
  graduationTx: string;
  liquidityWeth: number;
  priceEthPerToken: number;
  verified: boolean;
};

type RawLog = { data: string; blockNumber: string; transactionHash: string };

/** Fetch raw LaunchedToDEX logs from the explorer (newest last). */
async function fetchLaunchedToDexLogs(): Promise<{ token: string; pool: string; block: number; tx: string }[]> {
  const url =
    `${flapConfig.explorer}/api?module=logs&action=getLogs` +
    `&fromBlock=${flapConfig.portal.deploymentBlock}&toBlock=latest` +
    `&address=${flapConfig.portal.address}&topic0=${flapConfig.events.LaunchedToDEX.topic0}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  const json = (await res.json()) as { result?: RawLog[] };
  if (!Array.isArray(json.result)) return [];
  return json.result.map((L) => {
    const data = L.data.slice(2);
    const word = (i: number) => data.slice(i * 64, i * 64 + 64);
    return {
      token: getAddress(`0x${word(0).slice(24)}`),
      pool: getAddress(`0x${word(1).slice(24)}`),
      block: parseInt(L.blockNumber, 16),
      tx: L.transactionHash,
    };
  });
}

/**
 * Recent graduated Flap tokens, newest first, enriched + verified. `limit`
 * caps the number enriched (each enrich = a few RPC reads). `verifyOnchain`
 * re-proves DEX status + pool for each (slower, but honest).
 */
export async function fetchRecentGraduations(limit = 24, verifyOnchain = false): Promise<FlapGraduate[]> {
  const logs = await fetchLaunchedToDexLogs();
  const recent = logs.slice(-limit).reverse();
  const out = await Promise.all(
    recent.map(async (g): Promise<FlapGraduate | null> => {
      try {
        const [symbol, name, info] = await Promise.all([
          client.readContract({ address: g.token as `0x${string}`, abi: erc20Abi, functionName: "symbol" }).catch(() => ""),
          client.readContract({ address: g.token as `0x${string}`, abi: erc20Abi, functionName: "name" }).catch(() => ""),
          getPoolInfo(g.token, g.pool),
        ]);
        let verified = false;
        if (verifyOnchain) verified = (await resolveGraduation(g.token)) !== null;
        return {
          token: g.token as `0x${string}`,
          pool: g.pool as `0x${string}`,
          symbol: symbol as string,
          name: name as string,
          graduationBlock: g.block,
          graduationTx: g.tx,
          liquidityWeth: info?.liquidityWeth ?? 0,
          priceEthPerToken: info?.priceEthPerToken ?? 0,
          verified,
        };
      } catch {
        return null;
      }
    }),
  );
  return out.filter((x): x is FlapGraduate => x !== null);
}

/** Total graduation count (all-time) from the explorer log index. */
export async function graduationCount(): Promise<number> {
  const logs = await fetchLaunchedToDexLogs();
  return logs.length;
}
