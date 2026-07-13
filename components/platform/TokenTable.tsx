"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import StockLogo from "@/components/StockLogo";
import Badge from "@/components/ui/Badge";
import { curveProgressLabel, curveBarWidth } from "@/lib/format/curve";
import type { LaunchedToken } from "@/types/token";

const fmt = (n?: number) =>
  n === undefined
    ? "—"
    : n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `$${(n / 1_000).toFixed(1)}K`
        : `$${n.toFixed(0)}`;

export default function TokenTable({ tokens }: { tokens: LaunchedToken[] }) {
  const router = useRouter();
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left font-mono text-[12.5px]">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="px-5 py-3.5 font-medium">Token</th>
              <th className="px-5 py-3.5 font-medium">Pair</th>
              <th className="px-5 py-3.5 font-medium">Price</th>
              <th className="px-5 py-3.5 font-medium">Mcap</th>
              <th className="px-5 py-3.5 font-medium">Vol 24h</th>
              <th className="px-5 py-3.5 font-medium">Reward pool</th>
              <th className="px-5 py-3.5 font-medium">Curve</th>
              <th className="px-5 py-3.5 font-medium" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => (
              <tr
                key={t.address}
                onClick={() => router.push(`/token/${t.address}`)}
                className="cursor-pointer border-b border-border-soft transition-colors last:border-0 hover:bg-muted/60"
              >
                <td className="px-5 py-3.5">
                  <span className="flex items-center gap-2">
                    <span className="font-sans font-semibold text-foreground">
                      ${t.symbol}
                    </span>
                    {t.isDemo && <Badge variant="demo">Demo</Badge>}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <StockLogo ticker={t.stockSymbol} size={11} brandColor />
                    {t.stockSymbol}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">
                  {t.priceUsd !== undefined ? `$${t.priceUsd}` : "—"}
                </td>
                <td className="px-5 py-3.5 text-foreground">{fmt(t.marketCapUsd)}</td>
                <td className="px-5 py-3.5 text-foreground">{fmt(t.volume24hUsd)}</td>
                <td className="px-5 py-3.5 text-success">
                  {fmt(t.holderRewardPoolUsd)}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-border-soft">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: curveBarWidth(t.curveProgress) }}
                      />
                    </div>
                    <span className="text-[10.5px] text-muted-foreground">
                      {curveProgressLabel(t.curveProgress)}%
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Link
                    href={`/token/${t.address}?action=buy`}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-full bg-primary px-3 py-1 font-sans text-[11.5px] font-semibold text-primary-foreground"
                  >
                    Buy
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
