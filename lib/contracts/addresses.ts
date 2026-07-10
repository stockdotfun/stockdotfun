import { platformConfig } from "@/lib/config";

/**
 * Deployed contract addresses, sourced from environment variables only.
 * A `null` address means "not configured" — the UI must degrade to a
 * clearly-labeled disabled state, never fake activity.
 */
export const contractAddresses = platformConfig.addresses;

export type ContractName = keyof typeof contractAddresses;

export function requireAddress(name: ContractName): `0x${string}` {
  const addr = contractAddresses[name];
  if (!addr) {
    throw new Error(
      `Contract address "${name}" is not configured. Set the corresponding NEXT_PUBLIC_* env variable.`,
    );
  }
  return addr;
}
