"use client";

import { formatEther } from "viem";
import { Gift, Clock, Check } from "lucide-react";
import Button from "@/components/ui/Button";
import { useWalletNetwork } from "@/lib/web3/hooks";
import { useFlapRewards } from "@/hooks/useFlapRewards";

function fmtStock(wei: bigint): string {
  const n = Number(formatEther(wei));
  if (n === 0) return "0";
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 3 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function countdown(endsAt: number): string {
  const s = endsAt - Math.floor(Date.now() / 1000);
  if (s <= 0) return "ended";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

/**
 * "Your stock rewards" panel for Flap-graduate trading. Honest states: campaign
 * paused, epoch accruing (claim later), awaiting reveal, claimable, or claimed.
 * Never shows a reward before it's finalized + backed.
 */
export default function FlapRewardsCard() {
  const { isConnected, connectWallet } = useWalletNetwork();
  const r = useFlapRewards();

  if (!r.configured) return null;

  // Campaign paused entirely.
  if (!r.campaignActive) {
    return (
      <Shell>
        <p className="text-[13px] text-muted-foreground">
          The stock-reward campaign is <strong className="text-foreground">paused</strong>. Trade graduated Flap
          tokens through StockDotFun to earn random tokenized-stock rewards when it&apos;s active.
        </p>
      </Shell>
    );
  }

  if (!isConnected) {
    return (
      <Shell>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] text-muted-foreground">
            Connect your wallet to see your reward credits for epoch #{r.epochId.toString()}.
          </p>
          <Button onClick={connectWallet} size="sm">
            Connect
          </Button>
        </div>
      </Shell>
    );
  }

  const hasCredits = r.credits > 0n;
  const claimable = r.ended && r.reward?.ready && hasCredits && !r.claimed;

  return (
    <Shell>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Epoch #{r.epochId.toString()} ·{" "}
            {r.ended ? (
              "closed"
            ) : (
              <span className="inline-flex items-center gap-1 text-primary">
                <Clock size={10} /> ends in {countdown(r.endsAt)}
              </span>
            )}
          </p>
          <p className="mt-1 text-[15px] font-semibold text-foreground">
            {r.credits.toString()} reward credit{r.credits === 1n ? "" : "s"}
          </p>
        </div>

        {/* right side: state-dependent */}
        {r.claimed ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[11px] text-primary">
            <Check size={12} /> Claimed
          </span>
        ) : claimable ? (
          <div className="text-right">
            <p className="font-mono text-[11px] text-muted-foreground">You won</p>
            <p className="text-[15px] font-semibold text-primary">
              {r.reward ? `${fmtStock(r.reward.amount)} ${r.reward.symbol}` : "—"}
            </p>
          </div>
        ) : !hasCredits ? (
          <span className="font-mono text-[11px] text-muted-foreground">
            No eligible trades yet
          </span>
        ) : r.ended && !r.reward?.ready ? (
          <span className="font-mono text-[11px] text-warning">Awaiting epoch reveal</span>
        ) : (
          <span className="font-mono text-[11px] text-muted-foreground">
            Claimable after the epoch closes
          </span>
        )}
      </div>

      {claimable && (
        <div className="mt-4">
          <Button onClick={r.claim} loading={r.claiming} className="w-full" size="lg">
            <Gift size={15} /> Claim {r.reward?.symbol}
          </Button>
        </div>
      )}

      {r.claimTx && (
        <p className="mt-3 text-center text-[11px] text-primary">
          Claimed —{" "}
          <a
            href={`https://robinhoodchain.blockscout.com/tx/${r.claimTx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            view transaction
          </a>
        </p>
      )}
      {r.claimError && <p className="mt-3 text-center text-[11px] text-destructive">{r.claimError}</p>}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-5">
      <div className="mb-3 flex items-center gap-2">
        <Gift size={15} className="text-primary" />
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-foreground">
          Your stock rewards
        </h2>
      </div>
      {children}
    </div>
  );
}
