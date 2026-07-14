"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { explorerAddressUrl } from "@/lib/config";

/**
 * Prominent, copy-to-clipboard contract-address highlight for the landing hero.
 * Shows the FULL address (meme-launch convention) with a one-tap copy and an
 * explorer link, accented with the brand primary so it stands out at a glance.
 */
export default function ContractAddressBadge({
  address,
  label = "$STOCK",
}: {
  address: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const explorer = explorerAddressUrl(address);

  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="mx-auto flex max-w-full flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-2xl border border-primary/40 bg-primary/[0.06] px-3.5 py-2.5 shadow-[0_0_28px_-10px_var(--primary)] backdrop-blur">
      <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
        {label} CA
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label} contract address`}
        className="group flex min-w-0 items-center gap-2 transition-colors"
      >
        <span className="break-all font-mono text-[11px] text-foreground sm:text-[13px]">
          {address}
        </span>
        <span className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground">
          {copied ? (
            <Check size={14} className="text-primary" />
          ) : (
            <Copy size={14} />
          )}
        </span>
      </button>
      {explorer && (
        <a
          href={explorer}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View contract on explorer"
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ExternalLink size={14} />
        </a>
      )}
      {copied && (
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-primary">
          Copied
        </span>
      )}
    </div>
  );
}
