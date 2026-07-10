import type { Metadata } from "next";
import DocShell, { DocSection } from "@/components/layout/DocShell";
import StockLogo from "@/components/StockLogo";
import Badge from "@/components/ui/Badge";
import {
  BASE_ASSETS,
  STOCK_ASSETS,
  ETF_ASSETS,
} from "@/lib/assets/robinhoodAssets";
import type { StockAsset } from "@/types/token";

export const metadata: Metadata = {
  title: "Supported assets",
  description:
    "The verified registry of supported Robinhood Chain tokenized assets.",
};

function AssetTable({ title, assets }: { title: string; assets: StockAsset[] }) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3 font-medium">Asset</th>
                <th className="px-4 py-3 font-medium">Contract</th>
                <th className="px-4 py-3 font-medium">Decimals</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.address} className="border-b border-border-soft last:border-0">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2.5">
                      <StockLogo ticker={a.symbol} size={14} brandColor />
                      <span>
                        <span className="font-mono font-bold text-foreground">
                          {a.symbol}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          {a.displayName}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={a.blockscoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[11.5px] text-primary hover:underline"
                    >
                      {a.address?.slice(0, 8)}…{a.address?.slice(-6)}
                    </a>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {a.decimals}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={a.enabled ? "success" : "default"}>
                      {a.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                    {a.riskLabel !== "standard" && (
                      <Badge variant="warning" className="ml-1.5">
                        {a.riskLabel}
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function SupportedAssetsDoc() {
  return (
    <DocShell
      title="Supported assets"
      subtitle="Every address below is an official Robinhood Chain contract, verified against docs.robinhood.com, live on-chain metadata reads, and Blockscout. Assets can be enabled or disabled by protocol configuration."
    >
      <AssetTable title="Tokenized stocks" assets={STOCK_ASSETS} />
      <AssetTable title="Tokenized ETFs" assets={ETF_ASSETS} />
      <AssetTable title="Base assets" assets={BASE_ASSETS} />

      <DocSection heading="Important">
        <p>
          These are <strong>supported tokenized stock assets</strong> issued on
          Robinhood Chain — StockDotFun does not issue them. They may provide
          economic exposure but are <strong>not real shares</strong>, confer no
          stock ownership, and pay no dividends through this platform.
          Availability is subject to supported assets, liquidity, jurisdiction,
          and protocol configuration. Disabled assets verified correctly but
          have thin on-chain liquidity and are held back deliberately.
        </p>
        <p>
          Verification evidence:{" "}
          <code>docs/mainnet-verification/token-address-verification.md</code>{" "}
          in the repository.
        </p>
      </DocSection>
    </DocShell>
  );
}
