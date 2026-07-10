"use client";

import {
  areContractsConfigured,
  isChainConfigured,
  isRoutingConfigured,
  appEnv,
  platformConfig,
} from "@/lib/config";
import { DEFAULT_FEE_SPLIT } from "@/lib/data/fees";

const NETWORK_LABEL: Record<typeof appEnv, string> = {
  mainnet: "Robinhood Chain",
  testnet: "Robinhood Chain Testnet",
  local: "Local chain",
};

/**
 * Launch configuration shown in the create flow.
 * Fee values are the documented protocol defaults (docs/economics/); once the
 * factory is deployed they should be read from the contract instead.
 * TODO(contracts): read feeConfig from StockDotFunFactory when configured.
 */
export function useLaunchConfig() {
  return {
    feeSplit: DEFAULT_FEE_SPLIT,
    launchCostLabel: areContractsConfigured
      ? "Network gas only"
      : "Set at deployment",
    network: NETWORK_LABEL[appEnv],
    appEnv,
    contractsConfigured: areContractsConfigured,
    chainConfigured: isChainConfigured,
    routingConfigured: isRoutingConfigured,
    demoMode: platformConfig.demoMode,
  };
}
