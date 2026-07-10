"use client";

import { useCallback } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useChainId,
} from "wagmi";
import { robinhoodChain } from "@/lib/chains/robinhood";
import { isChainConfigured } from "@/lib/config";

/**
 * Wallet + network state in one hook.
 * `wrongNetwork` is only meaningful when the chain is actually configured.
 */
export function useWalletNetwork() {
  const { address, isConnected, isConnecting } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending: isConnectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const wrongNetwork =
    isConnected && isChainConfigured && chainId !== robinhoodChain.id;

  const connectWallet = useCallback(() => {
    const injectedConnector = connectors[0];
    if (injectedConnector) connect({ connector: injectedConnector });
  }, [connect, connectors]);

  const switchToRobinhoodChain = useCallback(() => {
    switchChain({ chainId: robinhoodChain.id });
  }, [switchChain]);

  return {
    address,
    isConnected,
    isConnecting: isConnecting || isConnectPending,
    wrongNetwork,
    chainConfigured: isChainConfigured,
    connectWallet,
    disconnect,
    switchToRobinhoodChain,
    isSwitching,
  };
}

export function shortAddress(address?: string, chars = 4) {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}
