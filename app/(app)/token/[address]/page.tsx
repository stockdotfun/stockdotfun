"use client";

import { use } from "react";
import TokenAvatar from "@/components/platform/TokenAvatar";
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
import CandleChart from "@/components/platform/CandleChart";
import CreatorRewardCard from "@/components/platform/CreatorRewardCard";
import RewardClaimCard from "@/components/platform/RewardClaimCard";
import { useTokenDetail } from "@/hooks/useExploreTokens";
import { useOnchainSpot } from "@/hooks/useTokenLive";
import TokenActivity from "@/components/platform/TokenActivity";
import { useEthPrice } from "@/hooks/useEthPrice";
import { formatUsd } from "@/lib/format/usd";
import { curveProgressLabel, curveBarWidth } from "@/lib/format/curve";
import { GRADUATION_MARKET_CAP_ETH } from "@/lib/curve/graduation";
import { stockTokenAddress } from "@/lib/assets/robinhoodAssets";
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

/** Compact number formatter that scales precision to magnitude. */
const fmtNum = (n: number, maxFrac = 4) => {
  if (!Number.isFinite(n)) return "0";
  if (n === 0) return "0";
  if (n >= 1_000_000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 0.0001) return n.toLocaleString("en-US", { maximumFractionDigits: maxFrac });
  return n.toExponential(2);
};

export default function TokenPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const { token, trades, isLoading } = useTokenDetail(address);
  const { address: viewer } = useAccount();
  const ethUsd = useEthPrice();
  // Live curve spot — price + market cap are available the instant the coin
  // exists, before any trade is indexed.
  const spot = useOnchainSpot(token?.address);

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

  // Live market-cap / volume, derived from indexed trades and priced in USD via
  // the ETH/USD rate (WETH ≈ ETH). Market cap = latest price-per-token × 1e9.
  const priced = trades.filter((t) => (t.quoteAmountEth ?? 0) > 0 && t.tokenAmount > 0);
  const latest = priced.length
    ? priced.reduce((a, b) => (b.timestamp > a.timestamp ? b : a))
    : undefined;
  const marketCapEth = latest ? (latest.quoteAmountEth! / latest.tokenAmount) * 1e9 : undefined;
  const cutoff = Date.now() / 1000 - 86_400;
  const volume24hEth = priced
    .filter((t) => t.timestamp >= cutoff)
    .reduce((s, t) => s + (t.quoteAmountEth ?? 0), 0);

  const usdOrEth = (eth?: number) =>
    eth === undefined
      ? "—"
      : ethUsd
        ? formatUsd(eth * ethUsd)
        : `${eth.toLocaleString("en-US", { maximumFractionDigits: 4 })} ETH`;


  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <TokenAvatar
          symbol={token.symbol}
          imageUrl={token.imageUrl}
          metadataURI={token.metadataURI}
          className="h-14 w-14 rounded-full"
          fallbackClassName="text-xl"
        />
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

      {/* Stats — price + market cap come from the LIVE curve spot (instant,
          no indexer), volume from trades. */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Price"
          value={
            spot && ethUsd
              ? `$${(spot.priceEth * ethUsd).toPrecision(2).replace(/e.*$/, "")}`
              : spot
                ? `${spot.priceEth.toPrecision(2)} ETH`
                : "—"
          }
        />
        <StatCard label="Market cap" value={usdOrEth(spot?.mcapEth ?? marketCapEth)} />
        <StatCard label="24h volume" value={usdOrEth(volume24hEth || undefined)} />
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
            <CardHeader title="Market cap" mono />
            <CardBody>
              <CandleChart
                trades={trades}
                symbol={token.symbol}
                usdPerEth={ethUsd}
                spotMcapEth={spot?.mcapEth}
              />
            </CardBody>
          </Card>

          <TokenActivity token={token} trades={trades} ethUsd={ethUsd} />
        </div>

        <div className="space-y-5">
          <TradingPanel token={token} />

          <RewardClaimCard
            stockSymbol={token.stockSymbol}
            stockAddress={stockTokenAddress(token.stockSymbol)}
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
                <span>{curveProgressLabel(token.curveProgress)}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border-soft">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: curveBarWidth(token.curveProgress) }}
                />
              </div>
              <p className="mt-3 flex items-center justify-between text-[11.5px] leading-relaxed text-muted-foreground">
                <span>
                  Bonds at{" "}
                  <span className="font-medium text-foreground">
                    {ethUsd
                      ? formatUsd(GRADUATION_MARKET_CAP_ETH * ethUsd)
                      : `${GRADUATION_MARKET_CAP_ETH.toFixed(1)} ETH`}
                  </span>{" "}
                  market cap
                </span>
                <span>Holders: {token.holderCount?.toLocaleString() ?? "—"}</span>
              </p>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground/80">
                At graduation, liquidity migrates to a locked Uniswap pool.
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
