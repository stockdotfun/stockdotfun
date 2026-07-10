"use client";

import StockLogo from "@/components/StockLogo";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import TransactionStatus from "@/components/platform/TransactionStatus";
import { areContractsConfigured } from "@/lib/config";
import { useClaim } from "@/hooks/useClaim";

/**
 * Holder reward claim card. When contracts are configured and a token address
 * is provided, the Claim button claims the ETH (WETH) reward from the token's
 * RewardVault and unwraps it to native ETH. Otherwise it stays disabled.
 */
export default function RewardClaimCard({
  stockSymbol,
  claimableLabel,
  sourceLabel,
  tokenAddress,
}: {
  stockSymbol: string;
  claimableLabel: string;
  sourceLabel: string;
  tokenAddress?: `0x${string}`;
}) {
  const claim = useClaim();
  const canClaim = areContractsConfigured && !!tokenAddress;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted text-foreground">
            <StockLogo ticker={stockSymbol} size={15} brandColor />
          </span>
          <span>
            <p className="font-mono text-[13px] font-bold text-foreground">
              {stockSymbol}
            </p>
            <p className="text-[11px] text-muted-foreground">{sourceLabel}</p>
          </span>
        </span>
        {!areContractsConfigured && <Badge variant="warning">Not configured</Badge>}
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
        {claimableLabel}
      </p>
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Claimable rewards (paid in ETH)
      </p>
      <Button
        disabled={!canClaim || claim.isBusy}
        loading={claim.isBusy}
        onClick={() => tokenAddress && claim.claimHolderRewards(tokenAddress)}
        className="mt-4 w-full"
      >
        {claim.isBusy
          ? claim.step === "unwrapping"
            ? "Unwrapping…"
            : "Claiming…"
          : canClaim
            ? "Claim ETH"
            : "Claiming unavailable"}
      </Button>

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
