import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card ${className ?? ""}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
  mono,
}: {
  title: ReactNode;
  action?: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border-soft px-5 py-3.5">
      {mono ? (
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
      ) : (
        <p className="text-[14.5px] font-semibold tracking-tight text-foreground">
          {title}
        </p>
      )}
      {action}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`p-5 ${className ?? ""}`}>{children}</div>;
}
