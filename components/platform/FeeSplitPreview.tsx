import type { FeeSplit } from "@/types/token";

const ROUTES = [
  { key: "holderShareBps", label: "Holder stock-token vault", cls: "bg-primary" },
  { key: "creatorShareBps", label: "Creator rewards", cls: "bg-success/70" },
  { key: "protocolShareBps", label: "Protocol treasury", cls: "bg-border" },
] as const;

export default function FeeSplitPreview({
  feeSplit,
  stockSymbol,
}: {
  feeSplit: FeeSplit;
  stockSymbol?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/50 p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Fee route · {(feeSplit.totalBps / 100).toFixed(1)}% per trade
        </p>
      </div>
      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full">
        {ROUTES.map((r) => (
          <div
            key={r.key}
            className={r.cls}
            style={{ width: `${feeSplit[r.key] / 100}%` }}
          />
        ))}
      </div>
      <div className="mt-3 space-y-1.5">
        {ROUTES.map((r) => (
          <div key={r.key} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${r.cls}`} />
              {r.key === "holderShareBps" && stockSymbol
                ? `Holder ${stockSymbol} vault`
                : r.label}
            </span>
            <span className="font-mono text-[12px] text-foreground">
              {(feeSplit[r.key] / 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
