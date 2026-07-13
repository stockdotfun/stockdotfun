"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import StockLogo from "@/components/StockLogo";
import Badge from "@/components/ui/Badge";
import TokenAvatar from "@/components/platform/TokenAvatar";
import { shortAddress } from "@/lib/web3/hooks";
import type { LaunchedToken } from "@/types/token";

const fmt = (n?: number) =>
  n === undefined
    ? "—"
    : n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `$${(n / 1_000).toFixed(1)}K`
        : `$${n.toFixed(0)}`;

export default function TokenCard({ token }: { token: LaunchedToken }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <TokenAvatar
            symbol={token.symbol}
            imageUrl={token.imageUrl}
            metadataURI={token.metadataURI}
            className="h-11 w-11 rounded-full"
            fallbackClassName="text-[16px]"
          />
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-foreground">
              ${token.symbol}
            </p>
            <p className="text-[11.5px] text-muted-foreground">{token.name}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {token.isDemo && <Badge variant="demo">Demo</Badge>}
          <span className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-1 font-mono text-[10px] font-bold text-foreground">
            <StockLogo ticker={token.stockSymbol} size={10} brandColor />
            {token.stockSymbol}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[11px]">
        <div>
          <p className="text-muted-foreground">MCAP</p>
          <p className="mt-0.5 text-foreground">{fmt(token.marketCapUsd)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">VOL 24H</p>
          <p className="mt-0.5 text-foreground">{fmt(token.volume24hUsd)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">REWARDS</p>
          <p className="mt-0.5 text-success">{fmt(token.holderRewardPoolUsd)}</p>
        </div>
      </div>

      <div className="mt-3.5">
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>
            {token.status === "graduated" ? "Graduated" : "Curve progress"}
          </span>
          <span>{token.curveProgress}%</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border-soft">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${token.curveProgress}%` }}
          />
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between pt-4">
        <span className="font-mono text-[10.5px] text-muted-foreground">
          by {shortAddress(token.creator, 3)}
        </span>
        <div className="flex gap-2">
          <Link
            href={`/token/${token.address}`}
            className="rounded-full border border-border px-3.5 py-1.5 text-[12px] font-semibold text-foreground transition-colors hover:border-primary/50"
          >
            View
          </Link>
          <Link
            href={`/token/${token.address}?action=buy`}
            className="rounded-full bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-primary-foreground transition-transform hover:scale-[1.04]"
          >
            Buy
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
