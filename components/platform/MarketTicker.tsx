"use client";

import StockLogo from "@/components/StockLogo";
import { platformConfig } from "@/lib/config";

export type TickerQuote = {
  symbol: string;
  changePct: number;
};

/**
 * Horizontal stock-quote ticker.
 * Accepts real quotes via `quotes`; without them it renders a demo preview
 * feed (only when demo mode is on) or nothing at all — never fake live data.
 * TODO(prices): feed real quotes from an onchain price feed or market API.
 */
const DEMO_QUOTES: TickerQuote[] = [
  { symbol: "TSLA", changePct: 0.8 },
  { symbol: "AAPL", changePct: 1.2 },
  { symbol: "NVDA", changePct: 2.4 },
  { symbol: "HOOD", changePct: 0.6 },
  { symbol: "SPY", changePct: 0.3 },
];

export default function MarketTicker({ quotes }: { quotes?: TickerQuote[] }) {
  const isDemo = !quotes;
  const data = quotes ?? (platformConfig.demoMode ? DEMO_QUOTES : null);
  if (!data || data.length === 0) return null;

  const row = (
    <div className="flex items-center gap-8 pr-8">
      {isDemo && (
        <span className="rounded border border-warning/40 px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-widest text-warning">
          Demo preview
        </span>
      )}
      {data.map((q) => (
        <span
          key={q.symbol}
          className="flex items-center gap-2 whitespace-nowrap font-mono text-[11.5px]"
        >
          <span className="text-foreground/80">
            <StockLogo ticker={q.symbol} size={11} />
          </span>
          <span className="text-foreground">{q.symbol}</span>
          <span className={q.changePct >= 0 ? "text-primary" : "text-destructive"}>
            {q.changePct >= 0 ? "+" : ""}
            {q.changePct.toFixed(1)}%
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <div
      className="relative overflow-hidden border-b border-border-soft bg-card/60 py-1.5"
      aria-hidden="true"
    >
      <div className="marquee-track">
        {row}
        {row}
        {row}
        {row}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
