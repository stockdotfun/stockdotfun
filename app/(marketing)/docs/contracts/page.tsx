import type { Metadata } from "next";
import DocShell, { DocSection } from "@/components/layout/DocShell";
import Badge from "@/components/ui/Badge";
import { platformConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Contracts",
  description: "StockDotFun contract architecture and deployed addresses.",
};

const CONTRACTS = [
  {
    name: "StockDotFunFactory",
    role: "Creates meme tokens, registers metadata, wires pools and vaults.",
    address: platformConfig.addresses.factory,
  },
  {
    name: "StockAssetRegistry",
    role: "Admin-controlled list of supported stock-token assets.",
    address: platformConfig.addresses.registry,
  },
  {
    name: "RouterAdapter",
    role: "Configurable interface for converting fees into stock-token assets.",
    address: platformConfig.addresses.router,
  },
  {
    name: "BondingCurvePool (per token)",
    role: "Handles buy/sell, prices the curve, applies the fee split.",
    address: null,
  },
  {
    name: "RewardVault (per token)",
    role: "Holds stock-token rewards; eligible holders claim from it.",
    address: null,
  },
  {
    name: "CreatorRewardVault",
    role: "Tracks creator rewards, claimable in ETH or stock token.",
    address: null,
  },
];

export default function ContractsDoc() {
  return (
    <DocShell
      title="Contracts"
      subtitle="The onchain architecture. Source lives in /contracts (Foundry). Addresses appear here once deployment is configured."
    >
      <div className="space-y-3">
        {CONTRACTS.map((c) => (
          <div
            key={c.name}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-mono text-[13.5px] font-bold text-foreground">
                {c.name}
              </p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">{c.role}</p>
            </div>
            {c.address ? (
              <code className="font-mono text-[11.5px] text-primary">{c.address}</code>
            ) : (
              <Badge variant="warning">Not deployed</Badge>
            )}
          </div>
        ))}
      </div>

      <DocSection heading="Security model">
        <p>
          Contracts use OpenZeppelin (Ownable, ReentrancyGuard, SafeERC20),
          validate supported assets against the registry, enforce fee caps,
          reject zero addresses, and emit full events for indexing. The
          foundation is <strong>unaudited</strong> — an independent audit is
          required before mainnet deployment.
        </p>
      </DocSection>
    </DocShell>
  );
}
