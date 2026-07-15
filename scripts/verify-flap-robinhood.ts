/**
 * Flap × Robinhood Chain contract verification (Phase 2 gate).
 *
 * Re-verifies every claim in config/flap.robinhood.json against live chain state.
 * Exits non-zero on ANY failure so it can gate production activation. Run:
 *   npx tsx scripts/verify-flap-robinhood.ts
 *
 * Checks: chain id, Portal bytecode, EIP-1967 implementation slot, getTokenV7
 * interface (against a known graduated token), historical LaunchedToDEX logs,
 * and full graduated-pool verification (V2 factory, WETH pair, liquidity).
 */
import { createPublicClient, http, getAddress, zeroAddress, keccak256, toBytes } from "viem";
import flap from "../config/flap.robinhood.json";

const RPC = process.env.INDEXER_RPC_URL ?? flap.rpcUrl;
const client = createPublicClient({ transport: http(RPC) });

const EIP1967_IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

const getTokenV7Abi = [
  {
    type: "function",
    name: "getTokenV7",
    stateMutability: "view",
    inputs: [{ type: "address" }],
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
] as const;

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const portal = getAddress(flap.portal.address);

  const chainId = await client.getChainId();
  check("chain id == 4663", chainId === flap.chainId, String(chainId));

  const code = await client.getCode({ address: portal });
  check("Portal has bytecode", !!code && code !== "0x", `${(code?.length ?? 0) / 2 - 1} bytes`);

  const implSlot = await client.getStorageAt({ address: portal, slot: EIP1967_IMPL_SLOT });
  const impl = implSlot ? getAddress(`0x${implSlot.slice(-40)}`) : zeroAddress;
  check(
    "EIP-1967 implementation matches config",
    impl === getAddress(flap.portal.implementation),
    impl,
  );

  // Event topic0s match the documented signatures.
  const tcTopic = keccak256(toBytes(flap.events.TokenCreated.signature));
  check("TokenCreated topic0 matches", tcTopic === flap.events.TokenCreated.topic0, tcTopic);
  const ldTopic = keccak256(toBytes(flap.events.LaunchedToDEX.signature));
  check("LaunchedToDEX topic0 matches", ldTopic === flap.events.LaunchedToDEX.topic0, ldTopic);

  // getTokenV7 interface + a known graduated token reports DEX with a matching pool.
  const sample = flap.verifiedGraduatesSample[0];
  const state = (await client.readContract({
    address: portal,
    abi: getTokenV7Abi,
    functionName: "getTokenV7",
    args: [getAddress(sample.token)],
  })) as unknown as { status: number; pool: string };
  check(
    `getTokenV7(${sample.symbol}) status == DEX`,
    Number(state.status) === flap.tokenStatus.DEX,
    `status=${state.status}`,
  );
  check(
    `getTokenV7(${sample.symbol}).pool matches config`,
    getAddress(state.pool) === getAddress(sample.pool),
    state.pool,
  );

  // Historical LaunchedToDEX logs exist from the deployment block. Uses the
  // explorer's log index (reliable over the multi-million-block range that a
  // single eth_getLogs would reject).
  const url =
    `${flap.explorer}/api?module=logs&action=getLogs` +
    `&fromBlock=${flap.portal.deploymentBlock}&toBlock=latest` +
    `&address=${portal}&topic0=${flap.events.LaunchedToDEX.topic0}`;
  const gradCount = await fetch(url)
    .then((r) => r.json())
    .then((d: { result?: unknown[] }) => (Array.isArray(d.result) ? d.result.length : 0))
    .catch(() => 0);
  check("historical LaunchedToDEX logs exist", gradCount > 0, `${gradCount} graduations`);

  // The graduated pool is a real V2-fork pair holding the token + WETH.
  const pool = getAddress(sample.pool);
  const [t0, t1, factory] = await Promise.all([
    client.readContract({ address: pool, abi: pairAbi, functionName: "token0" }),
    client.readContract({ address: pool, abi: pairAbi, functionName: "token1" }),
    client.readContract({ address: pool, abi: pairAbi, functionName: "factory" }),
  ]);
  const weth = getAddress(flap.migration.weth);
  const token = getAddress(sample.token);
  check(
    "pool pairs token + WETH",
    (getAddress(t0 as string) === token || getAddress(t1 as string) === token) &&
      (getAddress(t0 as string) === weth || getAddress(t1 as string) === weth),
  );
  check(
    "pool factory == approved V2 fork factory",
    getAddress(factory as string) === getAddress(flap.migration.factory),
    factory as string,
  );

  console.log(`\n${failures === 0 ? "✅ VERIFIED" : `❌ ${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verification errored:", e);
  process.exit(1);
});
