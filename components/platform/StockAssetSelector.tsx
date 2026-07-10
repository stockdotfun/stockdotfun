"use client";

import StockLogo from "@/components/StockLogo";
import Badge from "@/components/ui/Badge";
import AddressCopy from "@/components/platform/AddressCopy";
import type { StockAsset } from "@/types/token";

export default function StockAssetSelector({
  assets,
  selected,
  onSelect,
}: {
  assets: StockAsset[];
  selected: string | null;
  onSelect: (symbol: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {assets.map((asset) => {
        const active = selected === asset.symbol;
        const selectable = asset.enabled;
        return (
          <button
            key={asset.symbol}
            type="button"
            disabled={!selectable}
            onClick={() => onSelect(asset.symbol)}
            className={`rounded-2xl border p-4 text-left transition-all ${
              active
                ? "-translate-y-0.5 border-primary/60 bg-primary/5"
                : selectable
                  ? "border-border bg-card hover:border-primary/40"
                  : "cursor-not-allowed border-border-soft bg-muted/40 opacity-60"
            }`}
          >
            <div className="flex items-start justify-between">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted ${active ? "text-foreground" : "text-muted-foreground"}`}
              >
                <StockLogo ticker={asset.symbol} size={18} brandColor={active} />
              </span>
              {asset.enabled ? (
                asset.address ? (
                  <Badge variant="success" dot>
                    Live
                  </Badge>
                ) : (
                  <Badge variant="warning">Awaiting config</Badge>
                )
              ) : (
                <Badge>Disabled</Badge>
              )}
            </div>
            <p className="mt-3 font-mono text-[14px] font-bold text-foreground">
              {asset.symbol}
            </p>
            <p className="text-[12px] text-muted-foreground">
              {asset.name} · Tokenized exposure
            </p>
            {asset.address && (
              <div className="mt-2">
                <AddressCopy address={asset.address} />
              </div>
            )}
            {asset.note && (
              <p className="mt-2 text-[10.5px] leading-snug text-warning">
                {asset.note}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
