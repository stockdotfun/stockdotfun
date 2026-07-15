"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import Badge from "@/components/ui/Badge";
import StatCard from "@/components/ui/StatCard";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import FlapTradePanel from "@/components/platform/FlapTradePanel";
import { useEthPrice } from "@/hooks/useEthPrice";
import { platformConfig } from "@/lib/config";
import { shortAddress } from "@/lib/web3/hooks";

const explorer = platformConfig.explorerUrl.replace(/\/$/, "");

type FlapTokenInfo = {
  isFlapToken: boolean;
  token: string;
  symbol: string;
  name: string;
  status: string;
  graduated: boolean;
  verifiedGraduated: boolean;
  taxBps: number;
  pool: string | null;
  liquidityWeth: number | null;
  priceEthPerToken: number | null;
  tradableThroughStockDotFun: boolean;
};

export default function FlapTokenPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const ethUsd = useEthPrice();
  const { data, isLoading } = useQuery({
    queryKey: ["flap-token", address],
    queryFn: async (): Promise<FlapTokenInfo | null> => {
      const res = await fetch(`/api/flap/tokens/${address}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

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

  if (!data || !data.isFlapToken) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Not a Flap token"
        description="The Flap Portal doesn't recognize this address as one of its tokens."
      />
    );
  }

  const priceUsd = data.priceEthPerToken && ethUsd ? data.priceEthPerToken * ethUsd : undefined;
  const liqUsd = data.liquidityWeth && ethUsd ? data.liquidityWeth * ethUsd : undefined;

  return (
    <div>
      <Link
        href="/flap"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} /> Flap Graduates
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">${data.symbol || "?"}</h1>
        <Badge variant="success">Graduated on Flap</Badge>
        {data.verifiedGraduated && (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-primary">
            <ShieldCheck size={11} /> on-chain verified
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[13px] text-muted-foreground">
        {data.name || shortAddress(data.token)} ·{" "}
        <a
          href={`https://flap.sh/robinhood/${data.token}?lang=en`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary transition-colors hover:text-primary/80"
        >
          View on Flap <ExternalLink size={10} className="inline" />
        </a>
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Price" value={priceUsd ? `$${priceUsd.toPrecision(2).replace(/e.*$/, "")}` : "—"} />
        <StatCard label="Liquidity" value={liqUsd ? `$${(liqUsd / 1000).toFixed(1)}K` : `${data.liquidityWeth?.toFixed(2) ?? "—"} ETH`} />
        <StatCard label="Buy / Sell tax" value={`${(data.taxBps / 100).toFixed(1)}%`} />
        <StatCard label="Status" value={data.status} accent />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Launched on Flap · Graduated to DEX
            </p>
            <div className="mt-3 space-y-2 font-mono text-[12px]">
              <InfoRow label="Token" value={data.token} href={`${explorer}/address/${data.token}`} />
              {data.pool && <InfoRow label="DEX pool" value={data.pool} href={`${explorer}/address/${data.pool}`} />}
              <InfoRow label="Quote asset" plain="Native ETH (Uniswap V2 fork)" />
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
              This token launched on Flap&apos;s bonding curve and graduated to a Uniswap V2-fork pool on
              Robinhood Chain (proven via the Portal&apos;s <span className="font-mono">LaunchedToDEX</span> event).
              Trades here route to that pool through StockDotFun&apos;s gateway.{" "}
              <span className="text-foreground">
                Eligible trades can earn random tokenized-stock rewards while the campaign is active and funded.
              </span>
            </p>
          </div>
        </div>

        <FlapTradePanel token={data.token} symbol={data.symbol || "TOKEN"} />
      </div>
    </div>
  );
}

function InfoRow({ label, value, href, plain }: { label: string; value?: string; href?: string; plain?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      {plain ? (
        <span className="text-foreground">{plain}</span>
      ) : href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-foreground transition-colors hover:text-primary"
        >
          {shortAddress(value!, 6)} <ExternalLink size={10} />
        </a>
      ) : (
        <span className="text-foreground">{value}</span>
      )}
    </div>
  );
}
