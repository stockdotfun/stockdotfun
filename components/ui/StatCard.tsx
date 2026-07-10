import type { ReactNode } from "react";

export default function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1.5 text-xl font-semibold tracking-tight ${accent ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {sub}
        </p>
      )}
    </div>
  );
}
