import type { ReactNode } from "react";

type Variant = "default" | "success" | "warning" | "destructive" | "outline" | "demo";

const VARIANTS: Record<Variant, string> = {
  default: "border border-border bg-muted text-muted-foreground",
  success: "border border-primary/30 bg-primary/10 text-primary",
  warning: "border border-warning/30 bg-warning/10 text-warning",
  destructive: "border border-destructive/30 bg-destructive/10 text-destructive",
  outline: "border border-border text-foreground",
  demo: "border border-warning/40 bg-warning/10 text-warning",
};

export default function Badge({
  children,
  variant = "default",
  dot,
  className,
}: {
  children: ReactNode;
  variant?: Variant;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-widest ${VARIANTS[variant]} ${className ?? ""}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
