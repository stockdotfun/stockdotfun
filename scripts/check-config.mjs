/**
 * Production config guard — runs as `prebuild`.
 * Fails the build if mock/placeholder/dev addresses leak into the canonical
 * asset registry or into NEXT_PUBLIC_* contract env vars, or if demo mode is
 * combined with the mainnet chain id.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

const FORBIDDEN = [
  [/0xdddd/i, "demo-dataset placeholder (0xdddd…)"],
  [/0x5FbDB2315678afecb367f032d93F642f64180aa3/i, "anvil default deploy #1"],
  [/0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512/i, "anvil default deploy #2"],
  [/0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0/i, "anvil default deploy #3"],
  [/0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9/i, "anvil default deploy #4"],
  [/0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9/i, "anvil default deploy #5"],
  [/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266/i, "anvil default account #0"],
  [/MockWETH|MockStock|MockERC20/, "mock contract reference"],
];

// 1. Registry source must be clean.
const registrySrc = readFileSync(
  join(root, "lib/assets/robinhoodAssets.ts"),
  "utf8",
);
for (const [re, label] of FORBIDDEN) {
  if (re.test(registrySrc)) {
    errors.push(`lib/assets/robinhoodAssets.ts contains ${label}`);
  }
}

// 2. Env contract vars must not be mock/dev addresses.
const envVars = [
  "NEXT_PUBLIC_FACTORY_ADDRESS",
  "NEXT_PUBLIC_ROUTER_ADDRESS",
  "NEXT_PUBLIC_STOCK_ASSET_REGISTRY_ADDRESS",
  "NEXT_PUBLIC_REWARD_VAULT_ADDRESS",
  "NEXT_PUBLIC_CREATOR_REWARD_VAULT_ADDRESS",
  "NEXT_PUBLIC_WETH_ADDRESS",
  "NEXT_PUBLIC_USDG_ADDRESS",
  "NEXT_PUBLIC_PROTOCOL_TREASURY",
];
for (const key of envVars) {
  const v = process.env[key];
  if (!v) continue;
  for (const [re, label] of FORBIDDEN) {
    if (re.test(v)) errors.push(`${key}=${v} is a forbidden value (${label})`);
  }
}

// 3. Demo mode must never combine with mainnet chain id.
const chainId = process.env.NEXT_PUBLIC_CHAIN_ID || "4663";
if (chainId === "4663" && process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
  console.warn(
    "[check-config] WARNING: NEXT_PUBLIC_DEMO_MODE=true with mainnet chain id — " +
      "runtime hard-block will force demo mode OFF.",
  );
}

if (errors.length > 0) {
  console.error("[check-config] FAILED:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
console.log("[check-config] OK — no mock/placeholder addresses in production config.");
