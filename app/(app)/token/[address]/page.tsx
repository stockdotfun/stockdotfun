"use client";

import { use } from "react";
import Image from "next/image";
import { SearchX } from "lucide-react";
import { useAccount } from "wagmi";
import StockLogo from "@/components/StockLogo";
import Badge from "@/components/ui/Badge";
import StatCard from "@/components/ui/StatCard";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import AddressCopy from "@/components/platform/AddressCopy";
import TradingPanel from "@/components/platform/TradingPanel";
import TokenChart from "@/components/platform/TokenChart";
import CreatorRewardCard from "@/components/platform/CreatorRewardCard";
import RewardClaimCard from "@/components/platform/RewardClaimCard";
import { useTokenDetail } from "@/hooks/useExploreTokens";
import { shortAddress } from "@/lib/web3/hooks";
import { stockName } from "@/components/StockLogo";

const fmt = (n?: number) =>
  n === undefined
    ? "—"
    : n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `$${(n / 1_000).toFixed(1)}K`
        : `$${n.toFixed(0)}`;

export default function TokenPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const { token, trades, isLoading } = useTokenDetail(address);
  const { address: viewer } = useAccount();

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-20" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <EmptyState
        icon={SearchX}
        title="Token not found"
        description="This token isn't indexed yet, or the address is invalid."
      />
    );
  }

  const isCreator =
    viewer && viewer.toLowerCase() === token.creator.toLowerCase();

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        {token.imageUrl ? (
          <Image
            src={token.imageUrl}
            alt={token.name}
            width={56}
            height={56}
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-success text-xl font-bold text-primary-foreground">
            {token.symbol.charAt(0)}
          </span>
        )}
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              ${token.symbol}
            </h1>
            {token.isDemo && <Badge variant="demo">Demo</Badge>}
            <Badge variant={token.status === "graduated" ? "success" : "default"}>
              {token.status === "graduated" ? "Graduated" : "On curve"}
            </Badge>
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {token.name} · by {shortAddress(token.creator)}
          </p>
        </div>
        <div className="ml-auto flex flex-col items-end gap-2">
          <span className="flex items-center gap-2 rounded-full border border-border bg-muted px-3.5 py-1.5">
            <StockLogo ticker={token.stockSymbol} size={14} brandColor />
            <span className="font-mono text-[12.5px] font-bold text-foreground">
              {token.stockSymbol}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {stockName(token.stockSymbol)} · tokenized exposure
            </span>
          </span>
          <AddressCopy address={token.address} />
        </div>
      </div>

      {token.description && (
        <p className="mt-4 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
          {token.description}
        </p>
      )}

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Price"
          value={token.priceUsd !== undefined ? `$${token.priceUsd}` : "—"}
        />
        <StatCard label="Market cap" value={fmt(token.marketCapUsd)} />
        <StatCard label="24h volume" value={fmt(token.volume24hUsd)} />
        <StatCard
          label="Holder reward pool"
          value={fmt(token.holderRewardPoolUsd)}
          accent
          sub={`${token.stockSymbol} vault`}
        />
      </div>

      {/* Main grid */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Price chart" mono />
            <CardBody>
              <TokenChart />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent trades" mono />
            <CardBody className="!p-0">
              {trades.length === 0 ? (
                <p className="px-5 py-8 text-center text-[12.5px] text-muted-foreground">
                  No trades indexed yet.
                </p>
              ) : (
                <table className="w-full text-left font-mono text-[12px]">
                  <tbody>
                    {trades.map((tr) => (
                      <tr
                        key={tr.txHash}
                        className="border-b border-border-soft last:border-0"
                      >
                        <td className="px-5 py-3">
                          <span
                            className={
                              tr.side === "buy" ? "text-primary" : "text-destructive"
                            }
                          >
                            {tr.side.toUpperCase()}
                          </span>
                          {tr.isDemo && (
                            <span className="ml-2 text-[9px] uppercase text-warning">
                              demo
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-foreground">
                          ${tr.quoteAmountUsd.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {tr.tokenAmount.toLocaleString()} {token.symbol}
                        </td>
                        <td className="px-5 py-3 text-right text-muted-foreground">
                          {shortAddress(tr.account, 3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <TradingPanel token={token} />

          <RewardClaimCard
            stockSymbol={token.stockSymbol}
            claimableLabel="—"
            sourceLabel={`$${token.symbol} holder vault`}
            tokenAddress={token.isDemo ? undefined : token.address}
          />

          {isCreator && <CreatorRewardCard token={token} />}

          <Card>
            <CardHeader title="Curve progress" mono />
            <CardBody>
              <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>Graduation</span>
                <span>{token.curveProgress}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border-soft">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${token.curveProgress}%` }}
                />
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                Holders: {token.holderCount?.toLocaleString() ?? "—"}
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <p className="mt-8 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
        Meme coins are highly volatile. Stock-token assets may provide
        economic exposure but do not represent direct ownership of underlying
        securities. Eligible holders may receive stock-token rewards —
        rewards depend on activity and protocol configuration and are never
        guaranteed. Nothing on this page is financial advice.
      </p>
    </div>
  );
}
