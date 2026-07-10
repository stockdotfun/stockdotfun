"use client";

import Link from "next/link";
import { Rocket, Wallet } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import CreatorRewardCard from "@/components/platform/CreatorRewardCard";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useWalletNetwork } from "@/lib/web3/hooks";

export default function CreatorPage() {
  const { isConnected, connectWallet } = useWalletNetwork();
  const { createdTokens } = usePortfolio();

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <EmptyState
          icon={Wallet}
          title="Connect to open your creator dashboard"
          description="Coins you've created, reward routing, and claimable creator rewards live here."
          action={<Button onClick={connectWallet}>Connect Wallet</Button>}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-foreground">
            Creator dashboard
          </h1>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">
            Creators earn from the markets they start.
          </p>
        </div>
        <Link
          href="/create"
          className="btn-sweep inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-[13.5px] font-semibold text-primary-foreground"
        >
          <Rocket size={14} />
          New launch
        </Link>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Coins created" value={createdTokens.length} />
        <StatCard label="Total volume" value="—" sub="awaiting indexer" />
        <StatCard label="ETH claimable" value="—" sub="awaiting contracts" />
        <StatCard label="Stock-token claimable" value="—" sub="awaiting contracts" />
      </div>

      <div className="mt-8">
        {createdTokens.length === 0 ? (
          <EmptyState
            icon={Rocket}
            title="You haven't launched anything yet"
            description="Create a coin, choose its stock pair, and your creator economy starts here."
            action={
              <Link
                href="/create"
                className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-[13.5px] font-semibold text-primary-foreground"
              >
                Create a coin
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {createdTokens.map((t) => (
              <CreatorRewardCard key={t.address} token={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
