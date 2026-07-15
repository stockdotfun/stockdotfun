"use client";

import { useQuery } from "@tanstack/react-query";

export type FlapGraduate = {
  token: string;
  pool: string;
  symbol: string;
  name: string;
  graduationBlock: number;
  graduationTx: string;
  liquidityWeth: number;
  priceEthPerToken: number;
  verified: boolean;
};

/** Real graduated Flap tokens from the verified Portal (via /api/flap/graduations). */
export function useFlapGraduates(limit = 24) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["flap-graduates", limit],
    staleTime: 60_000,
    queryFn: async (): Promise<FlapGraduate[]> => {
      const res = await fetch(`/api/flap/graduations?limit=${limit}`);
      if (!res.ok) throw new Error("failed");
      const json = (await res.json()) as { graduations: FlapGraduate[] };
      return json.graduations ?? [];
    },
  });
  return { graduates: data ?? [], isLoading, error };
}
