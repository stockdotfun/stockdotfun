"use client";

import { useQuery } from "@tanstack/react-query";
import { getIndexerClient } from "@/lib/indexer/client";
import { useEthPrice } from "@/hooks/useEthPrice";
import type { ExploreQuery } from "@/lib/indexer/types";
import type { LaunchedToken } from "@/types/token";

/** Fill the USD stat fields from ETH-denominated stats + the live ETH price. */
function withUsd(t: LaunchedToken, ethUsd?: number): LaunchedToken {
  if (!ethUsd) return t;
  return {
    ...t,
    marketCapUsd:
      t.marketCapUsd ?? (t.marketCapEth !== undefined ? t.marketCapEth * ethUsd : undefined),
    volume24hUsd:
      t.volume24hUsd ?? (t.volume24hEth !== undefined ? t.volume24hEth * ethUsd : undefined),
    holderRewardPoolUsd:
      t.holderRewardPoolUsd ??
      (t.holderRewardPoolEth !== undefined ? t.holderRewardPoolEth * ethUsd : undefined),
  };
}

export function useExploreTokens(query: ExploreQuery) {
  const client = getIndexerClient();
  const ethUsd = useEthPrice();
  const result = useQuery({
    queryKey: ["explore-tokens", client.source, query],
    queryFn: () => client.getTokens(query),
  });

  return {
    tokens: (result.data ?? []).map((t) => withUsd(t, ethUsd)),
    isLoading: result.isLoading,
    source: client.source,
  };
}

export function useTokenDetail(address: string) {
  const client = getIndexerClient();
  const ethUsd = useEthPrice();
  const token = useQuery({
    queryKey: ["token", client.source, address],
    queryFn: () => client.getToken(address),
  });
  const trades = useQuery({
    queryKey: ["token-trades", client.source, address],
    queryFn: () => client.getTrades(address),
  });

  return {
    token: token.data ? withUsd(token.data, ethUsd) : null,
    trades: trades.data ?? [],
    isLoading: token.isLoading,
    source: client.source,
  };
}
