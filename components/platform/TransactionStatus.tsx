"use client";

import { Loader2, Check, AlertTriangle, ExternalLink } from "lucide-react";

type Props = {
  isSubmitting?: boolean;
  isConfirming?: boolean;
  isSuccess?: boolean;
  error?: string | null;
  txUrl?: string | null;
};

/** Inline transaction lifecycle indicator: pending → confirming → done/failed. */
export default function TransactionStatus({
  isSubmitting,
  isConfirming,
  isSuccess,
  error,
  txUrl,
}: Props) {
  if (error) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-destructive" />
        <p className="break-words text-[12.5px] leading-snug text-destructive">
          {error}
        </p>
      </div>
    );
  }
  if (isSubmitting || isConfirming) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/60 px-4 py-3">
        <Loader2 size={15} className="spin-slow text-primary" />
        <p className="text-[12.5px] text-muted-foreground">
          {isSubmitting ? "Confirm in your wallet…" : "Transaction pending…"}
        </p>
        {txUrl && (
          <a
            href={txUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
          >
            View <ExternalLink size={11} />
          </a>
        )}
      </div>
    );
  }
  if (isSuccess) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check size={11} strokeWidth={3} />
        </span>
        <p className="text-[12.5px] font-medium text-foreground">
          Transaction confirmed.
        </p>
        {txUrl && (
          <a
            href={txUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
          >
            View <ExternalLink size={11} />
          </a>
        )}
      </div>
    );
  }
  return null;
}
