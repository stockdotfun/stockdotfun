import { ArrowRight, Info } from "lucide-react";
import StockLogo from "@/components/StockLogo";
import { isRoutingConfigured } from "@/lib/config";
import type { CreatorRewardPreference } from "@/types/token";

const PREF_LABEL: Record<CreatorRewardPreference, string> = {
  eth: "ETH",
  stock: "Selected stock token",
  split: "50/50 split",
};

export default function RewardRoutePreview({
  stockSymbol,
  preference,
}: {
  stockSymbol: string;
  preference: CreatorRewardPreference;
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/50 p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Reward routing
      </p>
      <div className="mt-3 space-y-2.5">
        <div className="flex items-center gap-2.5 text-[12.5px]">
          <span className="text-muted-foreground">Holders</span>
          <ArrowRight size={12} className="text-primary" />
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <StockLogo ticker={stockSymbol} size={12} brandColor />
            {stockSymbol} vault eligibility
          </span>
        </div>
        <div className="flex items-center gap-2.5 text-[12.5px]">
          <span className="text-muted-foreground">Creator</span>
          <ArrowRight size={12} className="text-primary" />
          <span className="font-medium text-foreground">
            {preference === "split"
              ? `ETH + ${stockSymbol}`
              : preference === "stock"
                ? stockSymbol
                : PREF_LABEL[preference]}
          </span>
        </div>
      </div>
      {!isRoutingConfigured && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2">
          <Info size={12} className="mt-0.5 shrink-0 text-warning" />
          <p className="text-[11px] leading-snug text-warning">
            Reward routing not configured yet. Until a verified router is set,
            holder fees accrue in ETH (WETH) rather than converting to the
            paired stock token.
          </p>
        </div>
      )}
      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
        Eligible holders may receive stock-token rewards funded by trading
        activity. Availability subject to supported assets, liquidity,
        jurisdiction, and protocol configuration.
      </p>
    </div>
  );
}
