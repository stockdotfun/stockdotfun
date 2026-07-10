import type { Metadata } from "next";
import DocShell, { DocSection } from "@/components/layout/DocShell";

export const metadata: Metadata = {
  title: "How it works",
  description: "What StockDotFun is and how launching, pairing, and rewards work.",
};

export default function HowItWorksDoc() {
  return (
    <DocShell
      title="How it works"
      subtitle="StockDotFun is a Robinhood Chain launchpad where meme coins are paired with supported tokenized stock assets."
    >
      <DocSection heading="What StockDotFun is">
        <p>
          Anyone can launch a meme coin on Robinhood Chain. At launch, the
          creator chooses a supported Stock Token — an ERC-20 asset that
          tracks a real equity — as the coin&apos;s pair. The pair is locked
          in and visible to every trader.
        </p>
        <p>
          <strong>Create meme. Choose stock pair. Launch.</strong> That&apos;s
          the whole user flow.
        </p>
      </DocSection>

      <DocSection heading="How launching works">
        <p>
          Launching happens in four steps: describe the meme (name, ticker,
          image), pick the stock pair, choose your creator reward preference
          (ETH, the stock token, or a 50/50 split), review, and create. The
          factory contract deploys the token and its trading pool in one
          transaction. No seed liquidity is required — trading starts on a
          bonding curve.
        </p>
      </DocSection>

      <DocSection heading="How stock-token pairing works">
        <p>
          Every trade through the launchpad pays a small fee. A configured
          share of that fee is routed toward accumulating the paired stock
          token in a public reward vault. The vault address is visible
          onchain — anyone can audit its balance.
        </p>
      </DocSection>

      <DocSection heading="How holder rewards may work">
        <p>
          Eligible holders may receive stock-token rewards from the vault,
          based on holding, trading activity, and protocol configuration.
          Rewards depend entirely on real trading activity —{" "}
          <strong>they are never guaranteed</strong>, and eligibility rules
          may change with protocol configuration.
        </p>
      </DocSection>

      <DocSection heading="How creator rewards work">
        <p>
          A share of trading fees accrues to the token&apos;s creator.
          Creators choose at launch whether rewards route in ETH, the
          selected stock token, or a 50/50 split — subject to liquidity,
          compliance, and technical availability.
        </p>
      </DocSection>

      <DocSection heading="What you should not assume">
        <p>
          Stock-token assets may provide economic exposure but{" "}
          <strong>do not represent direct ownership of underlying
          securities</strong>. StockDotFun does not issue tokenized stocks —
          it composes with assets that already exist on Robinhood Chain.
          Supported assets are configurable and may change. Availability may
          vary by jurisdiction and protocol configuration. Nothing on this
          platform is financial advice.
        </p>
      </DocSection>
    </DocShell>
  );
}
