import type { StockAsset } from "@/types/token";

/**
 * Registry validation — runs in `npm run check:config` (prebuild) and can be
 * called from tests. Throws with a full error list on any violation, so mock
 * or malformed addresses can never ship silently.
 */

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Known mock/dev address patterns that must never appear in production. */
const FORBIDDEN_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /^0xdddd/i, label: "demo-dataset placeholder (0xdddd…)" },
  { re: /^0x0{40}$/, label: "zero address" },
  // Default anvil/hardhat deterministic deployment addresses:
  { re: /^0x5FbDB2315678afecb367f032d93F642f64180aa3$/i, label: "anvil default deploy #1" },
  { re: /^0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512$/i, label: "anvil default deploy #2" },
  { re: /^0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0$/i, label: "anvil default deploy #3" },
  { re: /^0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9$/i, label: "anvil default deploy #4" },
  { re: /^0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9$/i, label: "anvil default deploy #5" },
  { re: /^0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266$/i, label: "anvil default account #0" },
];

export function isForbiddenAddress(addr: string): string | null {
  for (const { re, label } of FORBIDDEN_PATTERNS) {
    if (re.test(addr)) return label;
  }
  return null;
}

export function validateAssetRegistry(assets: StockAsset[]): string[] {
  const errors: string[] = [];
  const seenAddr = new Set<string>();
  const seenSymbol = new Set<string>();

  for (const a of assets) {
    const id = `${a.symbol} (${a.address ?? "no address"})`;

    if (!a.symbol || !a.name || !a.displayName) {
      errors.push(`${id}: missing symbol/name/displayName`);
    }
    if (!a.address) {
      errors.push(`${id}: null address is not allowed in the canonical registry`);
      continue;
    }
    if (!ADDRESS_RE.test(a.address)) {
      errors.push(`${id}: malformed address`);
    }
    const forbidden = isForbiddenAddress(a.address);
    if (forbidden) {
      errors.push(`${id}: FORBIDDEN address — ${forbidden}`);
    }
    const lower = a.address.toLowerCase();
    if (seenAddr.has(lower)) errors.push(`${id}: duplicate address`);
    seenAddr.add(lower);
    if (seenSymbol.has(a.symbol)) errors.push(`${id}: duplicate symbol`);
    seenSymbol.add(a.symbol);

    if (!Number.isInteger(a.decimals) || a.decimals < 0 || a.decimals > 36) {
      errors.push(`${id}: implausible decimals ${a.decimals}`);
    }
    if (a.source !== "robinhood-docs") {
      errors.push(`${id}: unknown source "${a.source}" — only robinhood-docs allowed`);
    }
    if (!a.blockscoutUrl.startsWith("https://robinhoodchain.blockscout.com/")) {
      errors.push(`${id}: blockscoutUrl must point at the official explorer`);
    }
    if (a.type === "BASE_TOKEN" && a.riskLabel !== "standard") {
      errors.push(`${id}: base tokens must be standard risk`);
    }
  }
  return errors;
}

/** Throwing variant for prebuild/test use. */
export function assertAssetRegistryValid(assets: StockAsset[]): void {
  const errors = validateAssetRegistry(assets);
  if (errors.length > 0) {
    throw new Error(
      `Asset registry validation failed (${errors.length}):\n` +
        errors.map((e) => `  - ${e}`).join("\n"),
    );
  }
}
