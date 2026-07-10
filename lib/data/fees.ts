import type { FeeSplit } from "@/types/token";

/**
 * Intended protocol fee defaults, shared by server and client code.
 * Once the factory is deployed these should be read from the contract.
 */
export const DEFAULT_FEE_SPLIT: FeeSplit = {
  totalBps: 100, // 1% per trade
  holderShareBps: 4000, // 40% of the fee → holder stock-token vault
  creatorShareBps: 3000, // 30% of the fee → creator rewards
  protocolShareBps: 3000, // 30% of the fee → protocol treasury
};
