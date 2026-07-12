import { Clock, CheckCircle2, PauseCircle, AlertTriangle, CircleDashed } from "lucide-react";

/** Mirrors contracts' RewardConversionState (StockRewardTreasury). */
export type RewardConversionState =
  | "PENDING"
  | "ACTIVE"
  | "PAUSED"
  | "LOW_LIQUIDITY"
  | "FAILED";

const MAP: Record<
  RewardConversionState,
  { label: string; detail: string; tone: string; Icon: typeof Clock }
> = {
  PENDING: {
    label: "Stock rewards pending conversion",
    detail:
      "Fees are accruing in ETH and will be converted to the paired stock token in the next batch. No stock rewards have been converted yet.",
    tone: "text-muted-foreground border-border bg-muted/50",
    Icon: CircleDashed,
  },
  ACTIVE: {
    label: "Stock rewards available",
    detail:
      "Fees are being converted to the paired stock token and distributed to eligible holders and the creator.",
    tone: "text-success border-success/30 bg-success/5",
    Icon: CheckCircle2,
  },
  PAUSED: {
    label: "Conversion paused",
    detail: "Stock-reward conversion is temporarily paused by governance. Fees remain safe in ETH.",
    tone: "text-warning border-warning/30 bg-warning/5",
    Icon: PauseCircle,
  },
  LOW_LIQUIDITY: {
    label: "Conversion paused due to liquidity",
    detail:
      "The paired stock market is too thin to convert safely right now. Fees remain in ETH until liquidity recovers.",
    tone: "text-warning border-warning/30 bg-warning/5",
    Icon: AlertTriangle,
  },
  FAILED: {
    label: "Last conversion retry pending",
    detail:
      "The last conversion could not complete; fees are retained in ETH and a retry is queued. No stock rewards were fabricated.",
    tone: "text-warning border-warning/30 bg-warning/5",
    Icon: Clock,
  },
};

export default function RewardConversionStatus({
  state,
  pendingEthLabel,
}: {
  state: RewardConversionState;
  /** Optional human label for pending-but-unconverted ETH, e.g. "0.42 ETH". */
  pendingEthLabel?: string;
}) {
  const { label, detail, tone, Icon } = MAP[state];
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-center gap-2">
        <Icon size={14} className="shrink-0" />
        <p className="text-[13px] font-semibold">{label}</p>
      </div>
      <p className="mt-1.5 text-[11.5px] leading-snug opacity-90">{detail}</p>
      {pendingEthLabel && state !== "ACTIVE" && (
        <p className="mt-2 font-mono text-[11px]">Pending conversion: {pendingEthLabel}</p>
      )}
    </div>
  );
}
