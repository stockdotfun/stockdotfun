"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { shortAddress } from "@/lib/web3/hooks";
import { explorerAddressUrl } from "@/lib/config";

export default function AddressCopy({
  address,
  chars = 4,
}: {
  address: string;
  chars?: number;
}) {
  const [copied, setCopied] = useState(false);
  const explorer = explorerAddressUrl(address);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-2 py-1 font-mono text-[11.5px] text-muted-foreground">
      {shortAddress(address, chars)}
      <button
        type="button"
        aria-label="Copy address"
        onClick={() => {
          navigator.clipboard.writeText(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="transition-colors hover:text-foreground"
      >
        {copied ? <Check size={11} className="text-primary" /> : <Copy size={11} />}
      </button>
      {explorer && (
        <a
          href={explorer}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View on explorer"
          className="transition-colors hover:text-foreground"
        >
          <ExternalLink size={11} />
        </a>
      )}
    </span>
  );
}
