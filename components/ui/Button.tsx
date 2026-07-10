"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "outline";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "btn-sweep bg-primary text-primary-foreground hover:scale-[1.02] active:scale-[0.98] font-semibold",
  secondary:
    "border border-border bg-muted/60 text-foreground hover:border-primary/50 hover:bg-muted font-semibold",
  outline:
    "border border-border bg-transparent text-foreground hover:border-primary/50 font-medium",
  ghost: "text-muted-foreground hover:text-foreground font-medium",
  destructive:
    "bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 font-semibold",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[12.5px] gap-1.5",
  md: "h-10 px-5 text-[13.5px] gap-2",
  lg: "h-12 px-7 text-[14.5px] gap-2",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className ?? ""}`}
      {...props}
    >
      {loading && <Loader2 size={14} className="spin-slow" />}
      {children}
    </button>
  );
});

export default Button;
