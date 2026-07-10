"use client";

import Link from "next/link";
import StockLogo from "@/components/StockLogo";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import TransactionStatus from "@/components/platform/TransactionStatus";
import { areContractsConfigured } from "@/lib/config";
import { useClaim } from "@/hooks/useClaim";
import type { LaunchedToken } from "@/types/token";

const PREF_LABEL = {
  eth: "ETH",
  stock: "Stock token",
  split: "Auto-split",
} as const;

export default function CreatorRewardCard({ token }: { token: LaunchedToken }) {
  const claim = useClaim();
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[15px] font-semibold text-foreground">
            ${token.symbol}
          </p>
          <span className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            paired <StockLogo ticker={token.stockSymbol} size={10} brandColor />
            {token.stockSymbol}
          </span>
        </div>
        <Badge variant="outline">{PREF_LABEL[token.creatorRewardPreference]}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 font-mono text-[11.5px]">
        <div className="rounded-xl border border-border-soft bg-muted/50 px-3 py-2.5">
          <p className="text-muted-foreground">ETH claimable</p>
          <p className="mt-1 text-[14px] text-foreground">—</p>
        </div>
        <div className="rounded-xl border border-border-soft bg-muted/50 px-3 py-2.5">
          <p className="text-muted-foreground">{token.stockSymbol} claimable</p>
          <p className="mt-1 text-[14px] text-foreground">—</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2.5">
        <Button
          disabled={!areContractsConfigured || claim.isBusy}
          loading={claim.isBusy}
          onClick={() => claim.claimCreatorRewards()}
          className="flex-1"
          size="sm"
        >
          {claim.isBusy
            ? claim.step === "unwrapping"
              ? "Unwrapping…"
              : "Claiming…"
            : areContractsConfigured
              ? "Claim ETH"
              : "Claim unavailable"}
        </Button>
        <Link
          href={`/token/${token.address}`}
          className="flex h-8 items-center rounded-full border border-border px-3.5 text-[12.5px] font-medium text-foreground transition-colors hover:border-primary/50"
        >
          Manage
        </Link>
      </div>

      {(claim.isBusy || claim.error || claim.step === "done") && (
        <div className="mt-3">
          <TransactionStatus
            isConfirming={claim.isBusy}
            isSuccess={claim.step === "done"}
            error={claim.error}
            txUrl={claim.txUrl}
          />
        </div>
      )}
    </div>
  );
}
