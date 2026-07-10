import type { Metadata } from "next";
import { ShieldOff } from "lucide-react";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { SUPPORTED_ASSETS } from "@/lib/data/assets";
import { DEFAULT_FEE_SPLIT } from "@/lib/data/fees";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false },
};

/**
 * Admin foundation — environment-gated, read-only view of platform config.
 * Disabled in production unless ADMIN_ENABLED=true.
 * TODO(auth): replace the env gate with real authentication before exposing
 * any write actions (asset toggles, fee updates, treasury changes).
 */
const adminEnabled =
  process.env.NODE_ENV !== "production" || process.env.ADMIN_ENABLED === "true";

const ENV_ROWS = [
  { key: "NEXT_PUBLIC_CHAIN_ID", value: process.env.NEXT_PUBLIC_CHAIN_ID },
  { key: "NEXT_PUBLIC_RHC_RPC_URL", value: process.env.NEXT_PUBLIC_RHC_RPC_URL },
  { key: "NEXT_PUBLIC_ALCHEMY_RHC_RPC_URL", value: process.env.NEXT_PUBLIC_ALCHEMY_RHC_RPC_URL && "(set)" },
  { key: "NEXT_PUBLIC_RHC_EXPLORER_URL", value: process.env.NEXT_PUBLIC_RHC_EXPLORER_URL },
  { key: "NEXT_PUBLIC_WETH_ADDRESS", value: process.env.NEXT_PUBLIC_WETH_ADDRESS },
  { key: "NEXT_PUBLIC_USDG_ADDRESS", value: process.env.NEXT_PUBLIC_USDG_ADDRESS },
  { key: "NEXT_PUBLIC_FACTORY_ADDRESS", value: process.env.NEXT_PUBLIC_FACTORY_ADDRESS },
  { key: "NEXT_PUBLIC_ROUTER_ADDRESS", value: process.env.NEXT_PUBLIC_ROUTER_ADDRESS },
  { key: "NEXT_PUBLIC_STOCK_ASSET_REGISTRY_ADDRESS", value: process.env.NEXT_PUBLIC_STOCK_ASSET_REGISTRY_ADDRESS },
  { key: "NEXT_PUBLIC_REWARD_VAULT_ADDRESS", value: process.env.NEXT_PUBLIC_REWARD_VAULT_ADDRESS },
  { key: "NEXT_PUBLIC_CREATOR_REWARD_VAULT_ADDRESS", value: process.env.NEXT_PUBLIC_CREATOR_REWARD_VAULT_ADDRESS },
  { key: "NEXT_PUBLIC_PROTOCOL_TREASURY", value: process.env.NEXT_PUBLIC_PROTOCOL_TREASURY },
  { key: "NEXT_PUBLIC_DEMO_MODE", value: process.env.NEXT_PUBLIC_DEMO_MODE },
];

export default function AdminPage() {
  if (!adminEnabled) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <EmptyState
          icon={ShieldOff}
          title="Admin is disabled"
          description="Set ADMIN_ENABLED=true in the environment to access the admin foundation in production."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-[-0.02em] text-foreground">
          Admin
        </h1>
        <Badge variant="warning" dot>
          Foundation · read-only
        </Badge>
      </div>
      <p className="mt-2 text-[13.5px] text-muted-foreground">
        Write actions (asset toggles, fee updates, treasury changes) are
        performed via the contract owner until authenticated admin tooling
        ships.
      </p>

      <div className="mt-7 space-y-5">
        <Card>
          <CardHeader title="Supported stock assets" mono />
          <CardBody className="!p-0">
            <table className="w-full text-left font-mono text-[12px]">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Symbol</th>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Token address</th>
                  <th className="px-5 py-3 font-medium">Price feed</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {SUPPORTED_ASSETS.map((a) => (
                  <tr key={a.symbol} className="border-b border-border-soft last:border-0">
                    <td className="px-5 py-3 font-bold text-foreground">{a.symbol}</td>
                    <td className="px-5 py-3 text-muted-foreground">{a.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {a.address ?? "not configured"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {a.priceFeed ?? "not configured"}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={a.enabled ? "success" : "default"}>
                        {a.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Fee split config (defaults)" mono />
          <CardBody>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-[12px] sm:grid-cols-4">
              <span className="text-muted-foreground">Total fee</span>
              <span className="text-foreground">{DEFAULT_FEE_SPLIT.totalBps} bps</span>
              <span className="text-muted-foreground">Holder share</span>
              <span className="text-foreground">{DEFAULT_FEE_SPLIT.holderShareBps} bps</span>
              <span className="text-muted-foreground">Creator share</span>
              <span className="text-foreground">{DEFAULT_FEE_SPLIT.creatorShareBps} bps</span>
              <span className="text-muted-foreground">Protocol share</span>
              <span className="text-foreground">{DEFAULT_FEE_SPLIT.protocolShareBps} bps</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Environment / contract addresses" mono />
          <CardBody className="!p-0">
            <table className="w-full text-left font-mono text-[11.5px]">
              <tbody>
                {ENV_ROWS.map((row) => (
                  <tr key={row.key} className="border-b border-border-soft last:border-0">
                    <td className="px-5 py-2.5 text-muted-foreground">{row.key}</td>
                    <td className="px-5 py-2.5 text-foreground">
                      {row.value || <span className="text-warning">unset</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Feature flags" mono />
          <CardBody>
            <div className="flex flex-wrap gap-3">
              <Badge variant={process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "warning" : "default"} dot>
                Demo mode: {process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "on" : "off"}
              </Badge>
              <Badge variant="default" dot>
                Reported tokens: none (awaiting moderation backend)
              </Badge>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
