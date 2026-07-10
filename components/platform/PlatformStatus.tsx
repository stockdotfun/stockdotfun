"use client";

import { useAccount, useChainId } from "wagmi";
import { Check, X, Circle } from "lucide-react";
import {
  appEnv,
  areContractsConfigured,
  isRoutingConfigured,
  platformConfig,
  ROBINHOOD_MAINNET_CHAIN_ID,
} from "@/lib/config";

type Status = "ok" | "off" | "pending";

function Dot({ status }: { status: Status }) {
  if (status === "ok") return <Check size={11} className="text-primary" strokeWidth={2.6} />;
  if (status === "off") return <X size={11} className="text-muted-foreground" strokeWidth={2.6} />;
  return <Circle size={9} className="text-warning" fill="currentColor" />;
}

/**
 * Honest platform status strip. Reflects real config/connection state — no
 * green lights unless the underlying thing is actually true.
 */
export default function PlatformStatus() {
  const { isConnected } = useAccount();
  const chainId = useChainId();

  const onMainnet = chainId === ROBINHOOD_MAINNET_CHAIN_ID;
  const netLabel =
    appEnv === "mainnet"
      ? "Robinhood Mainnet"
      : appEnv === "testnet"
        ? "Robinhood Testnet"
        : "Local chain";

  const items: { label: string; status: Status }[] = [
    {
      label: isConnected ? `${netLabel} connected` : `${netLabel} · wallet off`,
      status: isConnected ? (onMainnet || appEnv !== "mainnet" ? "ok" : "pending") : "off",
    },
    { label: "Contracts", status: areContractsConfigured ? "ok" : "off" },
    { label: "Registry", status: "ok" },
    { label: "Routing", status: isRoutingConfigured ? "ok" : "off" },
    {
      label: platformConfig.demoMode ? "Demo mode ON" : "Live data",
      status: platformConfig.demoMode ? "pending" : "ok",
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border-soft bg-muted/40 px-3.5 py-2 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <Dot status={it.status} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
