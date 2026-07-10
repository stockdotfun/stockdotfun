"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, ...props },
  ref,
) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  return (
    <label className="block" htmlFor={inputId}>
      {label && (
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`mt-1.5 w-full rounded-xl border bg-card px-3.5 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary ${
          error ? "border-destructive" : "border-input"
        } ${className ?? ""}`}
        {...props}
      />
      {error ? (
        <span className="mt-1 block text-[11.5px] text-destructive">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11.5px] text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, hint, className, id, ...props }, ref) {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    return (
      <label className="block" htmlFor={inputId}>
        {label && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={`mt-1.5 w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary ${className ?? ""}`}
          {...props}
        />
        {hint && (
          <span className="mt-1 block text-[11.5px] text-muted-foreground">
            {hint}
          </span>
        )}
      </label>
    );
  },
);
