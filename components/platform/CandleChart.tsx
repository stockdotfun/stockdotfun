"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LineChart } from "lucide-react";
import type { CandlestickData, IChartApi, UTCTimestamp } from "lightweight-charts";
import EmptyState from "@/components/ui/EmptyState";
import { tradesToCandles, CANDLE_INTERVALS } from "@/lib/chart/candles";
import type { TokenTrade } from "@/types/token";

/** Format an ETH market-cap value with size-aware precision. */
function fmtMcap(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 100) return n.toFixed(2);
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

type Ohlc = { o: number; h: number; l: number; c: number };

/**
 * Pump.fun-style candlestick chart (TradingView lightweight-charts). Shows a
 * market-cap header + 24h change, an interval selector, and — overlaid on the
 * chart — a live legend ("$SYMBOL/ETH · Market Cap · <interval>" + O/H/L/C) that
 * follows the crosshair, exactly like pump.fun's DOGSY/SOL legend. Market cap is
 * price-per-token × 1e9 supply, expressed in ETH.
 */
export default function CandleChart({
  trades,
  symbol,
}: {
  trades: TokenTrade[];
  symbol: string;
}) {
  const [bucketSec, setBucketSec] = useState<number>(60);
  const containerRef = useRef<HTMLDivElement>(null);

  const { candles, volumes } = useMemo(
    () => tradesToCandles(trades, bucketSec),
    [trades, bucketSec],
  );

  const last = candles[candles.length - 1];
  const intervalLabel = CANDLE_INTERVALS.find((iv) => iv.sec === bucketSec)?.label ?? "";

  // 24h change: compare the latest close to the open of the earliest candle
  // within the last 24h (falls back to the first candle when data is younger).
  const changePct = useMemo(() => {
    if (!last || candles.length < 1) return 0;
    const dayAgo = last.time - 86_400;
    const ref = candles.find((c) => c.time >= dayAgo) ?? candles[0];
    return ref.open > 0 ? ((last.close - ref.open) / ref.open) * 100 : 0;
  }, [candles, last]);

  // Legend OHLC — follows the crosshair; defaults to the latest candle.
  const [hover, setHover] = useState<Ohlc | null>(null);
  const [hoverVol, setHoverVol] = useState<number | null>(null);
  useEffect(() => {
    setHover(null);
    setHoverVol(null);
  }, [candles]);

  const ohlc: Ohlc | null = hover ?? (last ? { o: last.open, h: last.high, l: last.low, c: last.close } : null);
  const lastVol = volumes.length ? volumes[volumes.length - 1].value : 0;
  const vol = hoverVol ?? lastVol;
  const up = ohlc ? ohlc.c >= ohlc.o : true;

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
      const upC = v("--primary", "#00c805");
      const downC = v("--destructive", "#f87171");
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
        rightPriceScale: { borderColor: grid, scaleMargins: { top: 0.18, bottom: 0.25 } },
        timeScale: { borderColor: grid, timeVisible: true, secondsVisible: bucketSec < 60 },
        crosshair: { mode: CrosshairMode.Normal },
        localization: { priceFormatter: (p: number) => fmtMcap(p) },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: upC,
        downColor: downC,
        borderUpColor: upC,
        borderDownColor: downC,
        wickUpColor: upC,
        wickDownColor: downC,
        priceLineVisible: false,
      });
      candleSeries.setData(candles.map((c) => ({ ...c, time: c.time as UTCTimestamp })));

      const volSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: "",
        priceFormat: { type: "volume" },
      });
      volSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
      const volByTime = new Map(volumes.map((vb) => [vb.time, vb.value]));
      volSeries.setData(
        volumes.map((vb) => ({
          time: vb.time as UTCTimestamp,
          value: vb.value,
          color: (vb.up ? upC : downC) + "66",
        })),
      );

      // Legend follows the crosshair; clears to the latest candle when off-chart.
      chart.subscribeCrosshairMove((param) => {
        const d = param.time ? (param.seriesData.get(candleSeries) as CandlestickData | undefined) : undefined;
        if (d && typeof d.open === "number") {
          setHover({ o: d.open, h: d.high, l: d.low, c: d.close });
          setHoverVol(volByTime.get(param.time as number) ?? 0);
        } else {
          setHover(null);
          setHoverVol(null);
        }
      });

      chart.timeScale().fitContent();

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

  if (candles.length === 0 || !last) {
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
      {/* pump.fun-style header: big market cap + 24h change, interval selector */}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Market cap
          </p>
          <p className="mt-0.5 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {fmtMcap(last.close)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">ETH</span>
            </span>
            <span className={`text-[12px] font-medium ${changePct >= 0 ? "text-success" : "text-destructive"}`}>
              {changePct >= 0 ? "+" : ""}
              {changePct.toFixed(2)}% 24h
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {CANDLE_INTERVALS.map((iv) => (
            <button
              key={iv.sec}
              type="button"
              onClick={() => {
                setBucketSec(iv.sec);
                setHover(null);
                setHoverVol(null);
              }}
              className={`rounded-md px-2 py-1 font-mono text-[11px] transition-colors ${
                bucketSec === iv.sec
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>
      </div>

      {/* chart + pump.fun-style legend overlay */}
      <div className="relative">
        <div className="pointer-events-none absolute left-2 top-1.5 z-10 space-y-0.5 font-mono text-[10.5px] leading-tight">
          <div className="text-foreground">
            ${symbol}/ETH
            <span className="text-muted-foreground"> · Market Cap · {intervalLabel}</span>
          </div>
          {ohlc && (
            <div className={up ? "text-success" : "text-destructive"}>
              O<span className="tabular-nums">{fmtMcap(ohlc.o)}</span>{"  "}
              H<span className="tabular-nums">{fmtMcap(ohlc.h)}</span>{"  "}
              L<span className="tabular-nums">{fmtMcap(ohlc.l)}</span>{"  "}
              C<span className="tabular-nums">{fmtMcap(ohlc.c)}</span>
            </div>
          )}
          <div className="text-muted-foreground">
            Volume <span className="tabular-nums text-foreground/80">{vol.toFixed(4)}</span> ETH
          </div>
        </div>
        <div ref={containerRef} className="h-[320px] w-full" />
      </div>
    </div>
  );
}
