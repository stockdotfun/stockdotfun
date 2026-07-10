import type { Metadata } from "next";
import DocShell, { DocSection } from "@/components/layout/DocShell";
import FeeSplitPreview from "@/components/platform/FeeSplitPreview";
import { DEFAULT_FEE_SPLIT } from "@/lib/data/fees";

export const metadata: Metadata = {
  title: "Fees",
  description: "Launchpad fee structure and reward routing.",
};

export default function FeesDoc() {
  return (
    <DocShell
      title="Fees"
      subtitle="One small fee per trade, routed by contract logic. No hidden transfer taxes between wallets."
    >
      <DocSection heading="The default split">
        <p>
          Every buy and sell through the launchpad pays a{" "}
          {(DEFAULT_FEE_SPLIT.totalBps / 100).toFixed(1)}% fee, split three
          ways:
        </p>
        <FeeSplitPreview feeSplit={DEFAULT_FEE_SPLIT} />
        <p>
          These are the intended defaults. Final values are set at deployment
          and read directly from the contracts — fee caps are enforced
          onchain.
        </p>
      </DocSection>

      <DocSection heading="Routing">
        <p>
          The holder share is used to accumulate the paired stock token in a
          public reward vault (via a configurable router adapter; if no
          router is configured, fees accrue in ETH until conversion is
          available). The creator share accrues to the creator&apos;s chosen
          route. The protocol share goes to the treasury.
        </p>
      </DocSection>

      <DocSection heading="What we avoid">
        <p>
          Fees apply at the launchpad buy/sell level —{" "}
          <strong>plain wallet-to-wallet transfers are not taxed</strong>. No
          reflection mechanics, no hidden transfer hooks that surprise
          integrators.
        </p>
      </DocSection>
    </DocShell>
  );
}
