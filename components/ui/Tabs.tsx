"use client";

export type TabItem = { value: string; label: string; count?: number };

export default function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      className={`no-scrollbar flex gap-1.5 overflow-x-auto rounded-full border border-border bg-muted/60 p-1 ${className ?? ""}`}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(item.value)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={`font-mono text-[10.5px] ${active ? "text-primary-foreground/80" : "text-muted-foreground/70"}`}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
