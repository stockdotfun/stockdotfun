import { defineChain, type Chain } from "viem";
import {
  platformConfig,
  appEnv,
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
} from "@/lib/config";

/**
 * Robinhood Chain — an Arbitrum L2 on Ethereum with native ETH gas.
 * All defaults verified against docs.robinhood.com/chain + live RPC reads
 * (2026-07-10). Env can override RPC (Alchemy preferred) and explorer.
 */
export const robinhoodChain: Chain = defineChain({
  id: platformConfig.chainId,
  name:
    appEnv === "mainnet"
      ? "Robinhood Chain"
      : appEnv === "testnet"
        ? "Robinhood Chain Testnet"
        : `Local Chain (${platformConfig.chainId})`,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [platformConfig.rpcUrl] },
    public: { http: [platformConfig.publicRpcUrl] },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Chain Blockscout",
      url: platformConfig.explorerUrl,
    },
  },
});

export const robinhoodMainnetId = ROBINHOOD_MAINNET_CHAIN_ID;
export const robinhoodTestnetId = ROBINHOOD_TESTNET_CHAIN_ID;
