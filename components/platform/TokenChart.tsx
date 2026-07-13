"use client";

import { LineChart } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

export type ChartPoint = { time: number; value: number };

/**
 * Lightweight SVG price chart. Accepts real points when an indexer/feed
 * exists; renders a clean empty state otherwise — never a fake chart.
 */
export default function TokenChart({ points }: { points?: ChartPoint[] }) {
  if (!points || points.length < 1) {
    return (
      <EmptyState
        icon={LineChart}
        title="No chart data yet"
        description="Price history appears once trades are indexed for this token."
      />
    );
  }

  // A single trade still deserves a chart: draw a flat line at that price by
  // duplicating the point so the path has two ends to span the width.
  const series = points.length === 1 ? [points[0], points[0]] : points;

  const min = Math.min(...series.map((p) => p.value));
  const max = Math.max(...series.map((p) => p.value));
  const flat = max === min; // single trade or all-equal prices
  const range = max - min || 1;
  const W = 720;
  const H = 260;
  const path = series
    .map((p, i) => {
      const x = (i / (series.length - 1)) * W;
      // Center a flat line vertically so it reads as a price, not zero.
      const norm = flat ? 0.5 : (p.value - min) / range;
      const y = H - 16 - norm * (H - 48);
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
