"use client";

import { useQuery } from "@tanstack/react-query";
import { getIndexerClient } from "@/lib/indexer/client";
import type { ExploreQuery } from "@/lib/indexer/types";

export function useExploreTokens(query: ExploreQuery) {
  const client = getIndexerClient();
  const result = useQuery({
    queryKey: ["explore-tokens", client.source, query],
    queryFn: () => client.getTokens(query),
  });

  return {
    tokens: result.data ?? [],
    isLoading: result.isLoading,
    source: client.source,
  };
}

export function useTokenDetail(address: string) {
  const client = getIndexerClient();
  const token = useQuery({
    queryKey: ["token", client.source, address],
    queryFn: () => client.getToken(address),
  });
  const trades = useQuery({
    queryKey: ["token-trades", client.source, address],
    queryFn: () => client.getTrades(address),
  });

  return {
    token: token.data ?? null,
    trades: trades.data ?? [],
    isLoading: token.isLoading,
    source: client.source,
  };
}
