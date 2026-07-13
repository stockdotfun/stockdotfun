"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Current ETH/USD spot from our cached /api/eth-price route. Returns `undefined`
 * while loading or if unavailable, so callers fall back to ETH-denominated
 * values. Cached for a minute — market caps don't need tick-level FX accuracy.
 */
export function useEthPrice(): number | undefined {
  const { data } = useQuery({
    queryKey: ["eth-usd"],
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
    queryFn: async (): Promise<number | null> => {
      try {
        const r = await fetch("/api/eth-price", { headers: { accept: "application/json" } });
        if (!r.ok) return null;
        const j = (await r.json()) as { usd?: number | null };
        return typeof j?.usd === "number" && j.usd > 0 ? j.usd : null;
      } catch {
        return null;
      }
    },
  });
  return data ?? undefined;
}
