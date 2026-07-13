"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LineChart } from "lucide-react";
import type { IChartApi, UTCTimestamp } from "lightweight-charts";
import EmptyState from "@/components/ui/EmptyState";
import { tradesToCandles, CANDLE_INTERVALS } from "@/lib/chart/candles";
import type { TokenTrade } from "@/types/token";

/**
 * Pump.fun-style candlestick chart (TradingView lightweight-charts). Renders
 * market-cap (ETH) OHLC candles + a volume histogram, aggregated from the
 * token's indexed trades. lightweight-charts is imported dynamically inside the
 * effect so it never runs during SSR.
 */
export default function CandleChart({ trades }: { trades: TokenTrade[] }) {
  const [bucketSec, setBucketSec] = useState<number>(60);
  const containerRef = useRef<HTMLDivElement>(null);

  const { candles, volumes } = useMemo(
    () => tradesToCandles(trades, bucketSec),
    [trades, bucketSec],
  );

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;
    let chart: IChartApi | null = null;
    let ro: ResizeObserver | null = null;
    let disposed = false;

    (async () => {
      const { createChart, CandlestickSeries, HistogramSeries, ColorType, CrosshairMode } =
        await import("lightweight-charts");
      const el = containerRef.current;
      if (disposed || !el) return;

      const css = getComputedStyle(document.documentElement);
      const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
      const up = v("--primary", "#00c805");
      const down = v("--destructive", "#f87171");
      const text = v("--muted-foreground", "#8a8f98");
      const grid = "rgba(128,128,128,0.12)";

      chart = createChart(el, {
        width: el.clientWidth,
        height: el.clientHeight || 320,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: text,
          fontFamily: "var(--font-mono, ui-monospace), monospace",
          fontSize: 11,
        },
        grid: { vertLines: { color: grid }, horzLines: { color: grid } },
        rightPriceScale: { borderColor: grid, scaleMargins: { top: 0.1, bottom: 0.25 } },
        timeScale: { borderColor: grid, timeVisible: true, secondsVisible: bucketSec < 60 },
        crosshair: { mode: CrosshairMode.Normal },
        localization: { priceFormatter: (p: number) => (p >= 100 ? p.toFixed(2) : p.toFixed(4)) },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: up,
        downColor: down,
        borderUpColor: up,
        borderDownColor: down,
        wickUpColor: up,
        wickDownColor: down,
        priceLineVisible: false,
      });
      candleSeries.setData(candles.map((c) => ({ ...c, time: c.time as UTCTimestamp })));

      const volSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: "",
        priceFormat: { type: "volume" },
      });
      volSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
      volSeries.setData(
        volumes.map((vb) => ({
          time: vb.time as UTCTimestamp,
          value: vb.value,
          color: (vb.up ? up : down) + "66",
        })),
      );

      chart.timeScale().fitContent();

      // Keep width in sync and re-fit; the initial fire also corrects the fit
      // once the container has its real laid-out width.
      ro = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect.width;
        if (w && chart) {
          chart.applyOptions({ width: Math.floor(w) });
          chart.timeScale().fitContent();
        }
      });
      ro.observe(el);
    })();

    return () => {
      disposed = true;
      ro?.disconnect();
      chart?.remove();
    };
  }, [candles, volumes, bucketSec]);

  if (candles.length === 0) {
    return (
      <EmptyState
        icon={LineChart}
        title="No chart data yet"
        description="The market-cap chart fills in as trades are indexed for this token."
      />
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5">
        {CANDLE_INTERVALS.map((iv) => (
          <button
            key={iv.sec}
            type="button"
            onClick={() => setBucketSec(iv.sec)}
            className={`rounded-md px-2 py-1 font-mono text-[11px] transition-colors ${
              bucketSec === iv.sec
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {iv.label}
          </button>
        ))}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Market cap · ETH
        </span>
      </div>
      <div ref={containerRef} className="h-[320px] w-full" />
    </div>
  );
}
