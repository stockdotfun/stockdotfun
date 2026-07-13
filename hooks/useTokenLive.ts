"use client";

import { useQuery } from "@tanstack/react-query";
import { formatEther } from "viem";
import type { LaunchedToken, TokenHolder } from "@/types/token";

/**
 * Live curve spot (price + market cap in ETH) read straight from the pool.
 * Available the instant a coin exists — no indexer, no trades required.
 * Refreshes every 10s so the header tracks trading in near-real-time.
 */
export function useOnchainSpot(tokenAddress?: string) {
  const { data } = useQuery({
    queryKey: ["pool-spot", tokenAddress?.toLowerCase()],
    enabled: !!tokenAddress,
    refetchInterval: 10_000,
    staleTime: 5_000,
    queryFn: async () => {
      const { fetchPoolSpot } = await import("@/lib/indexer/onchainFresh");
      return fetchPoolSpot(tokenAddress!);
    },
  });
  return data ?? null;
}

const INDEXER_BASE = (process.env.NEXT_PUBLIC_INDEXER_URL ?? "").replace(/\/$/, "");

/**
 * Holders for the token page: the indexer's holder table when available,
 * otherwise an instant on-chain fallback (bonding curve reserve + creator) so
 * a just-launched coin shows holders immediately.
 */
export function useTokenHolders(token: LaunchedToken | null) {
  const { data, isLoading } = useQuery({
    queryKey: ["token-holders", token?.address.toLowerCase()],
    enabled: !!token,
    refetchInterval: 15_000,
    queryFn: async (): Promise<TokenHolder[]> => {
      // 1) Indexer holders (exact, includes every buyer).
      if (INDEXER_BASE) {
        try {
          const res = await fetch(`${INDEXER_BASE}/tokens/${token!.address}/holders`, {
            headers: { accept: "application/json" },
          });
          if (res.ok) {
            const rows = (await res.json()) as { holder: string; balance: string }[];
            if (rows.length > 0) {
              return rows.map((r) => {
                const bal = Number(formatEther(BigInt(r.balance)));
                return { address: r.holder, balance: bal, pct: (bal / 1_000_000_000) * 100 };
              });
            }
          }
        } catch {
          // fall through to on-chain
        }
      }
      // 2) Instant on-chain fallback: curve reserve + creator balance.
      const { fetchOnchainHolders } = await import("@/lib/indexer/onchainFresh");
      return fetchOnchainHolders(token!.address, token!.creator);
    },
  });
  return { holders: data ?? [], isLoading };
}
