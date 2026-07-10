"use client";

import { useQuery } from "@tanstack/react-query";
import { SUPPORTED_ASSETS } from "@/lib/data/assets";
import { platformConfig } from "@/lib/config";
import type { StockAsset } from "@/types/token";

/**
 * Supported stock-token assets.
 * Source of truth today: the platform config (lib/data/assets.ts).
 * TODO(registry): when NEXT_PUBLIC_STOCKDOTFUN_REGISTRY_ADDRESS is set, read
 * the onchain StockAssetRegistry via wagmi and merge enabled/address fields.
 */
export function useSupportedAssets() {
  const query = useQuery<StockAsset[]>({
    queryKey: ["supported-assets", platformConfig.addresses.registry],
    queryFn: async () => SUPPORTED_ASSETS,
    staleTime: 60_000,
  });

  return {
    assets: query.data ?? [],
    enabledAssets: (query.data ?? []).filter((a) => a.enabled),
    isLoading: query.isLoading,
    registryConfigured: platformConfig.addresses.registry !== null,
  };
}
