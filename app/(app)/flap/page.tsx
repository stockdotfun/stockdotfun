"use client";

import { ExternalLink, ShieldCheck, Info } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { useFlapGraduates } from "@/hooks/useFlapGraduates";
import { platformConfig } from "@/lib/config";
import { shortAddress } from "@/lib/web3/hooks";

const TRADING_ENABLED = process.env.NEXT_PUBLIC_FLAP_INTEGRATION_ENABLED === "true";
const explorer = platformConfig.explorerUrl.replace(/\/$/, "");

function fmtEth(n: number) {
  if (!Number.isFinite(n) || n === 0) return "—";
  if (n >= 1) return `${n.toFixed(2)} ETH`;
  return `${n.toFixed(4)} ETH`;
}

export default function FlapGraduatesPage() {
  const { graduates, isLoading } = useFlapGraduates(24);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Flap Graduates</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <ShieldCheck size={11} className="text-primary" />
          Powered by Flap liquidity
        </span>
      </div>
      <p className="mt-1.5 max-w-2xl text-[13.5px] text-muted-foreground">
        Flap tokens that graduated from their bonding curve to a DEX on Robinhood Chain — proven on-chain
        via the verified Flap Portal&apos;s <span className="font-mono">LaunchedToDEX</span> event.
      </p>

      {/* Honest status banner — trading through StockDotFun is not yet enabled. */}
      {!TRADING_ENABLED && (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-foreground">
          <Info size={16} className="mt-0.5 shrink-0 text-warning" />
          <p>
            Integration is in verification. These are <strong>real graduated Flap tokens</strong>, but trading
            through StockDotFun and the stock-reward campaign are <strong>not yet enabled</strong> — the trading
            gateway and reward vault are built and tested but not deployed. For now, view each token on Flap or
            the explorer.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : graduates.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={ShieldCheck}
            title="No graduates loaded"
            description="Couldn't read graduations from the Portal right now. This page never shows a token as graduated without on-chain proof."
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {graduates.map((g) => (
            <Card key={g.token}>
              <CardBody>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-foreground">${g.symbol || "?"}</p>
                    <p className="truncate text-[12px] text-muted-foreground">{g.name || shortAddress(g.token)}</p>
                  </div>
                  <Badge variant="success">Graduated on Flap</Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 font-mono text-[11.5px]">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Liquidity</p>
                    <p className="mt-0.5 text-foreground">{fmtEth(g.liquidityWeth)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Price</p>
                    <p className="mt-0.5 text-foreground">
                      {g.priceEthPerToken > 0 ? `${g.priceEthPerToken.toExponential(2)} ETH` : "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3 text-[11.5px]">
                  <a
                    href={`https://flap.sh/robinhood/${g.token}?lang=en`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary transition-colors hover:text-primary/80"
                  >
                    Flap <ExternalLink size={11} />
                  </a>
                  <a
                    href={`${explorer}/tx/${g.graduationTx}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Graduation tx <ExternalLink size={11} />
                  </a>
                  <a
                    href={`${explorer}/address/${g.pool}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Pool <ExternalLink size={11} />
                  </a>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
