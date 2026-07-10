import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import FeeSplitPreview from "@/components/platform/FeeSplitPreview";
import StockLogo from "@/components/StockLogo";
import { DEFAULT_FEE_SPLIT } from "@/lib/data/fees";
import { SUPPORTED_ASSETS } from "@/lib/data/assets";

export const metadata: Metadata = {
  title: "Rewards",
  description:
    "How holder and creator rewards work on StockDotFun — powered by trading activity, routed toward supported stock-token assets.",
};

export default function RewardsPage() {
  const enabled = SUPPORTED_ASSETS.filter((a) => a.enabled);
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-semibold tracking-[-0.02em] text-foreground">
        Rewards, <span className="font-serif italic text-primary">explained.</span>
      </h1>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
        Every trade pays a small fee. The protocol routes it — toward the
        holder stock-token vault, creator rewards, and the treasury. No
        promises, just plumbing.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card id="holder">
          <CardHeader title="Holder rewards" mono />
          <CardBody>
            <p className="text-[13.5px] leading-relaxed text-muted-foreground">
              A share of every trading fee accumulates the paired stock token
              in a public vault. <strong className="text-foreground">Eligible
              holders may receive stock-token rewards</strong> based on
              holding, activity, and protocol configuration.
            </p>
            <Link
              href="/portfolio?tab=holder-rewards"
              className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
            >
              Check your claimable rewards <ArrowRight size={13} />
            </Link>
          </CardBody>
        </Card>

        <Card id="creator">
          <CardHeader title="Creator rewards" mono />
          <CardBody>
            <p className="text-[13.5px] leading-relaxed text-muted-foreground">
              Creators earn from the markets they start. Rewards route in{" "}
              <strong className="text-foreground">ETH, the selected stock
              token, or a 50/50 split</strong> — chosen at launch, subject to
              liquidity and availability.
            </p>
            <Link
              href="/portfolio?tab=creator-rewards"
              className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
            >
              Claim creator rewards <ArrowRight size={13} />
            </Link>
          </CardBody>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card>
          <CardHeader title="Fee routing" mono />
          <CardBody>
            <FeeSplitPreview feeSplit={DEFAULT_FEE_SPLIT} />
            <p className="mt-3 text-[11px] text-muted-foreground">
              Default split — final values are read from the deployed
              contracts.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Supported stock-token rewards" mono />
          <CardBody>
            <div className="flex flex-wrap gap-2.5">
              {enabled.map((a) => (
                <span
                  key={a.symbol}
                  className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 font-mono text-[12px] font-bold text-foreground"
                >
                  <StockLogo ticker={a.symbol} size={12} brandColor />
                  {a.symbol}
                </span>
              ))}
            </div>
            <p className="mt-4 text-[11.5px] leading-relaxed text-muted-foreground">
              Supported assets are configurable and may change. Availability
              subject to supported assets, liquidity, jurisdiction, and
              protocol configuration.
            </p>
          </CardBody>
        </Card>
      </div>

      <p className="mt-8 rounded-2xl border border-border-soft bg-muted/40 p-4 text-[11.5px] leading-relaxed text-muted-foreground">
        Stock-token assets may provide economic exposure but do not represent
        direct ownership of underlying securities. Rewards depend on trading
        activity and protocol configuration — they are never guaranteed, and
        nothing on this platform is financial advice.
      </p>
    </div>
  );
}
