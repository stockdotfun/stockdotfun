"use client";

import { useQuery } from "@tanstack/react-query";
import { ipfsToHttp } from "@/lib/metadata/ipfs";

/**
 * Resolve a token's launch image from its on-chain metadata URI. The metadata
 * JSON (pinned to IPFS at launch) holds an `image` ipfs:// URI; we fetch it once
 * and return an HTTP gateway URL. Metadata is immutable, so it's cached hard.
 * Returns `null` (never throws) when there's no URI or the fetch/parse fails,
 * so callers fall back to a letter avatar.
 */
export function useTokenImage(metadataURI?: string | null) {
  return useQuery({
    queryKey: ["token-image", metadataURI],
    enabled: !!metadataURI,
    staleTime: 1000 * 60 * 60, // 1h
    gcTime: 1000 * 60 * 60 * 24, // 1d
    retry: 1,
    queryFn: async (): Promise<string | null> => {
      const metaUrl = ipfsToHttp(metadataURI);
      if (!metaUrl) return null;
      try {
        const res = await fetch(metaUrl, { headers: { accept: "application/json" } });
        if (!res.ok) return null;
        const json = (await res.json()) as { image?: string };
        return ipfsToHttp(json.image);
      } catch {
        return null;
      }
    },
  });
}
