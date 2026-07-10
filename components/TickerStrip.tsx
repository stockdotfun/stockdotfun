const TICKS = [
  { pair: "$ROCKET / TSLA", change: "+14.2%", vol: "412K" },
  { pair: "$GPUINU / NVDA", change: "+9.8%", vol: "1.2M" },
  { pair: "$ORCHARD / AAPL", change: "+4.1%", vol: "268K" },
  { pair: "$HOODIE / HOOD", change: "+21.6%", vol: "733K" },
  { pair: "$SPYDER / SPY", change: "+2.4%", vol: "154K" },
  { pair: "$MOONX / PRIV*", change: "+7.7%", vol: "98K" },
];

export default function TickerStrip() {
  const row = (
    <div className="flex items-center gap-10 pr-10">
      <span className="rounded border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        Demo preview
      </span>
      {TICKS.map((t) => (
        <span
          key={t.pair}
          className="flex items-center gap-3 font-mono text-[12px] whitespace-nowrap"
        >
          <span className="text-foreground">{t.pair}</span>
          <span className="text-primary">{t.change}</span>
          <span className="text-muted-foreground">VOL {t.vol}</span>
        </span>
      ))}
    </div>
  );

  return (
    <div
      className="relative overflow-hidden border-y border-border-soft bg-card py-3"
      aria-hidden="true"
    >
      <div className="marquee-track">
        {row}
        {row}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-card to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-card to-transparent" />
    </div>
  );
}
