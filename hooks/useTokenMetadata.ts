"use client";

import { useQuery } from "@tanstack/react-query";
import { ipfsToHttp } from "@/lib/metadata/ipfs";
import type { TokenMetadata } from "@/lib/metadata/types";

/**
 * Fetch a token's full launch metadata JSON (pinned to IPFS at creation): image,
 * description, and the creator-supplied website / twitter / telegram links. The
 * JSON is immutable, so it's cached hard. Returns `null` (never throws) when
 * there's no URI or the fetch/parse fails. Sibling of {@link useTokenImage},
 * which only needs the image — this returns everything for the token page.
 */
export function useTokenMetadata(metadataURI?: string | null) {
  return useQuery({
    queryKey: ["token-metadata", metadataURI],
    enabled: !!metadataURI,
    staleTime: 1000 * 60 * 60, // 1h
    gcTime: 1000 * 60 * 60 * 24, // 1d
    retry: 1,
    queryFn: async (): Promise<Partial<TokenMetadata> | null> => {
      const metaUrl = ipfsToHttp(metadataURI);
      if (!metaUrl) return null;
      try {
        const res = await fetch(metaUrl, { headers: { accept: "application/json" } });
        if (!res.ok) return null;
        return (await res.json()) as Partial<TokenMetadata>;
      } catch {
        return null;
      }
    },
  });
}
