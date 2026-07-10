"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getIndexerClient } from "@/lib/indexer/client";
import type { LaunchedToken } from "@/types/token";

export type HoldingRow = {
  token: LaunchedToken;
  balance: number;
  valueUsd?: number;
  rewardEligible: boolean;
};

/**
 * Portfolio data for the connected wallet.
 * Live mode requires the indexer; until it exists everything is a clean
 * empty state. Demo tokens belong to synthetic creators, so demo mode shows
 * empty personal holdings too — we never pretend the user owns demo assets.
 */
export function usePortfolio() {
  const { address, isConnected } = useAccount();
  const client = getIndexerClient();

  const created = useQuery({
    queryKey: ["portfolio-created", client.source, address],
    queryFn: () => (address ? client.getTokensByCreator(address) : []),
    enabled: isConnected,
  });

  return {
    isConnected,
    address,
    holdings: [] as HoldingRow[], // TODO(indexer): balances via indexer/multicall
    createdTokens: created.data ?? [],
    isLoading: created.isLoading,
    source: client.source,
  };
}
