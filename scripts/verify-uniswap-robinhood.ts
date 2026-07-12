/**
 * Part 1 — Verify the real Robinhood Chain Uniswap V4 deployment.
 *
 * Resolves the canonical Uniswap addresses (from the official Uniswap
 * deployments registry, hard-pinned below) and proves, on-chain, that they are
 * a coherent V4 deployment on chain 4663. FAILS (exit 1) if:
 *   - chain id != 4663
 *   - any address has no bytecode
 *   - any periphery immutable does not point at the expected PoolManager/Permit2
 *   - WETH / Permit2 configuration is wrong
 *   - any address is zero
 *
 * Run: npx tsx scripts/verify-uniswap-robinhood.ts
 * Writes: docs/integrations/uniswap-robinhood-verification.md
 */
import { createPublicClient, http, parseAbi, getAddress, isAddressEqual } from "viem";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RPC = process.env.RHC_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const EXPECTED_CHAIN_ID = 4663;

const chain = {
  id: EXPECTED_CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
} as const;

// Canonical Robinhood Chain (4663) addresses — from the official Uniswap
// deployments registry (developers.uniswap.org/docs/protocols/v4/deployments)
// and the canonical cross-chain Permit2. Verified on-chain by this script.
const A = {
  poolManager: getAddress("0x8366a39cc670b4001a1121b8f6a443a643e40951"),
  positionManager: getAddress("0x58daec3116aae6d93017baaea7749052e8a04fa7"),
  positionDescriptor: getAddress("0x9639443158e8c5efa35bd45287bf2effd3d8dc06"),
  v4Quoter: getAddress("0x8dc178efb8111bb0973dd9d722ebeff267c98f94"),
  stateView: getAddress("0xf3334192d15450cdd385c8b70e03f9a6bd9e673b"),
  universalRouter: getAddress("0x8876789976decbfcbbbe364623c63652db8c0904"),
  permit2: getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3"),
  weth: getAddress("0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73"),
  usdg: getAddress("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"),
};

const client = createPublicClient({ chain, transport: http(RPC) });

const IMMUT_ABI = parseAbi([
  "function poolManager() view returns (address)",
  "function permit2() view returns (address)",
  "function owner() view returns (address)",
]);
const ERC20_ABI = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];
const record = (name: string, ok: boolean, detail: string) => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  —  ${detail}`);
};

async function main() {
  const chainId = await client.getChainId();
  record("chain id == 4663", chainId === EXPECTED_CHAIN_ID, `got ${chainId}`);

  for (const [name, addr] of Object.entries(A)) {
    if (isAddressEqual(addr, "0x0000000000000000000000000000000000000000")) {
      record(`${name} nonzero`, false, "address is zero");
      continue;
    }
    const code = await client.getBytecode({ address: addr });
    record(`${name} has bytecode`, !!code && code.length > 2, `${addr} (${code ? code.length : 0} chars)`);
  }

  const pmOfPosm = await client.readContract({ address: A.positionManager, abi: IMMUT_ABI, functionName: "poolManager" });
  record("PositionManager.poolManager() == PoolManager", isAddressEqual(pmOfPosm, A.poolManager), pmOfPosm);

  const p2OfPosm = await client.readContract({ address: A.positionManager, abi: IMMUT_ABI, functionName: "permit2" });
  record("PositionManager.permit2() == Permit2", isAddressEqual(p2OfPosm, A.permit2), p2OfPosm);

  const pmOfSv = await client.readContract({ address: A.stateView, abi: IMMUT_ABI, functionName: "poolManager" });
  record("StateView.poolManager() == PoolManager", isAddressEqual(pmOfSv, A.poolManager), pmOfSv);

  const pmOfQuoter = await client.readContract({ address: A.v4Quoter, abi: IMMUT_ABI, functionName: "poolManager" });
  record("V4Quoter.poolManager() == PoolManager", isAddressEqual(pmOfQuoter, A.poolManager), pmOfQuoter);

  const wSym = await client.readContract({ address: A.weth, abi: ERC20_ABI, functionName: "symbol" });
  const wDec = await client.readContract({ address: A.weth, abi: ERC20_ABI, functionName: "decimals" });
  record("WETH is WETH/18dp", wSym === "WETH" && wDec === 18, `${wSym}/${wDec}`);

  const uSym = await client.readContract({ address: A.usdg, abi: ERC20_ABI, functionName: "symbol" });
  record("USDG symbol", uSym === "USDG", uSym);

  const pmOwner = await client.readContract({ address: A.poolManager, abi: IMMUT_ABI, functionName: "owner" });
  record("PoolManager.owner() nonzero", !isAddressEqual(pmOwner, "0x0000000000000000000000000000000000000000"), pmOwner);

  const failed = checks.filter((c) => !c.ok);
  const md = [
    "# Uniswap V4 on Robinhood Chain — Verification (Part 1)",
    "",
    `RPC \`${RPC}\`, chain ${EXPECTED_CHAIN_ID}. All addresses verified on-chain.`,
    "",
    "## Canonical addresses",
    "| Contract | Address |",
    "|---|---|",
    ...Object.entries(A).map(([n, a]) => `| ${n} | \`${a}\` |`),
    "",
    "## Checks",
    "| Check | Result | Detail |",
    "|---|---|---|",
    ...checks.map((c) => `| ${c.name} | ${c.ok ? "PASS" : "FAIL"} | \`${c.detail}\` |`),
    "",
    failed.length ? `## RESULT: FAILED (${failed.length})` : "## RESULT: ALL PASS",
    "",
  ].join("\n");
  mkdirSync(join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "integrations"), { recursive: true });
  writeFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "integrations", "uniswap-robinhood-verification.md"),
    md,
  );

  if (failed.length) {
    console.error(`\n${failed.length} check(s) FAILED — aborting.`);
    process.exit(1);
  }
  console.log("\nAll Uniswap V4 checks passed. Wrote docs/integrations/uniswap-robinhood-verification.md");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
