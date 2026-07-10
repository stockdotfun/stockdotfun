"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Wallet, Coins, Gift, Rocket, History } from "lucide-react";
import Tabs from "@/components/ui/Tabs";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import CreatorRewardCard from "@/components/platform/CreatorRewardCard";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useWalletNetwork, shortAddress } from "@/lib/web3/hooks";

const TABS = [
  { value: "holdings", label: "Holdings" },
  { value: "holder-rewards", label: "Holder rewards" },
  { value: "creator-rewards", label: "Creator rewards" },
  { value: "created", label: "Created coins" },
  { value: "transactions", label: "Transactions" },
];

function PortfolioContent() {
  const params = useSearchParams();
  const initialTab = TABS.some((t) => t.value === params.get("tab"))
    ? (params.get("tab") as string)
    : "holdings";
  const [tab, setTab] = useState(initialTab);
  const { isConnected, address, connectWallet } = useWalletNetwork();
  const portfolio = usePortfolio();

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <EmptyState
          icon={Wallet}
          title="Connect your wallet"
          description="Your holdings, stock-token reward eligibility, creator rewards, and launch history live here."
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
            Portfolio
          </h1>
          <p className="mt-1.5 font-mono text-[12px] text-muted-foreground">
            {shortAddress(address, 6)}
          </p>
        </div>
        <Link
          href="/create"
          className="btn-sweep inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-[13.5px] font-semibold text-primary-foreground"
        >
          <Rocket size={14} />
          Create Coin
        </Link>
      </div>

      <div className="mt-7">
        <Tabs items={TABS} value={tab} onChange={setTab} />
      </div>

      <div className="mt-7">
        {tab === "holdings" && (
          <EmptyState
            icon={Coins}
            title="No holdings yet"
            description="Buy a market-native meme on Explore and it appears here with its pair and reward eligibility."
            action={
              <Link
                href="/explore"
                className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-[13.5px] font-semibold text-primary-foreground"
              >
                Explore coins
              </Link>
            }
          />
        )}

        {tab === "holder-rewards" && (
          <EmptyState
            icon={Gift}
            title="No claimable rewards"
            description="Eligible holders may receive stock-token rewards funded by trading activity. Claims appear here once reward vaults are live for your holdings."
          />
        )}

        {tab === "creator-rewards" &&
          (portfolio.createdTokens.length === 0 ? (
            <EmptyState
              icon={Gift}
              title="No creator rewards"
              description="Launch a coin to start earning creator rewards in ETH or the paired stock token."
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
              {portfolio.createdTokens.map((t) => (
                <CreatorRewardCard key={t.address} token={t} />
              ))}
            </div>
          ))}

        {tab === "created" &&
          (portfolio.createdTokens.length === 0 ? (
            <EmptyState
              icon={Rocket}
              title="Nothing launched yet"
              description="Coins you create show up here with volume and creator reward stats."
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
              {portfolio.createdTokens.map((t) => (
                <CreatorRewardCard key={t.address} token={t} />
              ))}
            </div>
          ))}

        {tab === "transactions" && (
          <EmptyState
            icon={History}
            title="No transactions"
            description="Buys, sells, claims, and launches from this wallet appear here once activity is indexed."
          />
        )}
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <Suspense>
      <PortfolioContent />
    </Suspense>
  );
}
