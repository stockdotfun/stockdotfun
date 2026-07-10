"use client";

import { LineChart } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

export type ChartPoint = { time: number; value: number };

/**
 * Lightweight SVG price chart. Accepts real points when an indexer/feed
 * exists; renders a clean empty state otherwise — never a fake chart.
 */
export default function TokenChart({ points }: { points?: ChartPoint[] }) {
  if (!points || points.length < 2) {
    return (
      <EmptyState
        icon={LineChart}
        title="No chart data yet"
        description="Price history appears once trades are indexed for this token."
      />
    );
  }

  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  const range = max - min || 1;
  const W = 720;
  const H = 260;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = H - 16 - ((p.value - min) / range) * (H - 48);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="Price chart"
    >
      <path
        d={`${path} L${W} ${H} L0 ${H} Z`}
        fill="var(--primary)"
        opacity="0.07"
      />
      <path d={path} stroke="var(--primary)" strokeWidth="2" fill="none" />
    </svg>
  );
}
