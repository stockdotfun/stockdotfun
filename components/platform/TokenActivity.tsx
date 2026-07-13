"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { useTokenHolders } from "@/hooks/useTokenLive";
import { explorerTxUrl, platformConfig } from "@/lib/config";
import { shortAddress } from "@/lib/web3/hooks";
import type { LaunchedToken, TokenTrade } from "@/types/token";

/** "23s", "4m", "2h", "3d" — Hoodl/pump.fun-style relative time. */
function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** Tiny per-token prices: $0.0002-style with sensible sig figs. */
function fmtTinyUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(2).replace(/e.*$/, "")}`;
}

function fmtAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/**
 * Hoodl-style activity panel: TRADES | HOLDERS tabs.
 * Trades: TIME · TYPE · PRICE · TOKENS · ETH · USD · WALLET · TX.
 * Holders: rank · wallet (curve/creator tagged) · amount · % of supply.
 */
export default function TokenActivity({
  token,
  trades,
  ethUsd,
}: {
  token: LaunchedToken;
  trades: TokenTrade[];
  ethUsd?: number;
}) {
  const [tab, setTab] = useState<"trades" | "holders">("trades");
  const { holders, isLoading: holdersLoading } = useTokenHolders(token);

  const tag = (addr: string): string | null => {
    const a = addr.toLowerCase();
    if (a === token.pool.toLowerCase()) return "BONDING CURVE";
    if (a === token.creator.toLowerCase()) return "CREATOR";
    return null;
  };

  const explorerAddr = (addr: string) =>
    `${platformConfig.explorerUrl}/address/${addr}`;

  return (
    <div className="rounded-2xl border border-border bg-card">
      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-border-soft px-4 py-3">
        {(["trades", "holders"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "trades" ? (
        trades.length === 0 ? (
          <p className="px-5 py-8 text-center text-[12.5px] text-muted-foreground">
            No trades yet — be the first to buy.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-[11.5px]">
              <thead>
                <tr className="border-b border-border-soft text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Time</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Price</th>
                  <th className="px-4 py-2.5 font-medium">Tokens</th>
                  <th className="px-4 py-2.5 font-medium">ETH</th>
                  <th className="px-4 py-2.5 font-medium">USD</th>
                  <th className="px-4 py-2.5 font-medium">Wallet</th>
                  <th className="px-4 py-2.5 text-right font-medium">Tx</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((tr, i) => {
                  const eth = tr.quoteAmountEth ?? 0;
                  const priceUsd =
                    ethUsd && tr.tokenAmount > 0 ? (eth / tr.tokenAmount) * ethUsd : undefined;
                  return (
                    <tr key={`${tr.txHash}-${i}`} className="border-b border-border-soft last:border-0">
                      <td className="px-4 py-2.5 text-muted-foreground">{timeAgo(tr.timestamp)}</td>
                      <td className={`px-4 py-2.5 font-bold ${tr.side === "buy" ? "text-primary" : "text-destructive"}`}>
                        {tr.side === "buy" ? "Buy" : "Sell"}
                      </td>
                      <td className="px-4 py-2.5 text-foreground">
                        {priceUsd !== undefined ? fmtTinyUsd(priceUsd) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-foreground">{fmtAmount(tr.tokenAmount)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{eth.toFixed(6)}</td>
                      <td className="px-4 py-2.5 text-foreground">
                        {ethUsd ? `$${(eth * ethUsd).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <a
                          href={explorerAddr(tr.account)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {shortAddress(tr.account, 3)}
                        </a>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {tr.txHash && (
                          <a
                            href={explorerTxUrl(tr.txHash as `0x${string}`) ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="View transaction"
                            className="inline-block text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : holdersLoading && holders.length === 0 ? (
        <p className="px-5 py-8 text-center text-[12.5px] text-muted-foreground">Loading holders…</p>
      ) : holders.length === 0 ? (
        <p className="px-5 py-8 text-center text-[12.5px] text-muted-foreground">No holders yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[11.5px]">
            <thead>
              <tr className="border-b border-border-soft text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">Wallet</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {holders.map((h, i) => {
                const t = tag(h.address);
                return (
                  <tr key={h.address} className="border-b border-border-soft last:border-0">
                    <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <a
                        href={explorerAddr(h.address)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-foreground transition-colors hover:text-primary"
                      >
                        {shortAddress(h.address as `0x${string}`, 4)}
                      </a>
                      {t && (
                        <span className="ml-2 rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-primary">
                          {t}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-foreground">{fmtAmount(h.balance)}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {h.pct >= 0.01 ? h.pct.toFixed(2) : "<0.01"}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
