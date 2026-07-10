import type { Metadata } from "next";
import DocShell, { DocSection } from "@/components/layout/DocShell";

export const metadata: Metadata = {
  title: "Risk disclosure",
  description: "Serious risks you accept by using StockDotFun.",
};

export default function RiskPage() {
  return (
    <DocShell
      title="Risk disclosure"
      subtitle="Read this before using the platform. Using StockDotFun means accepting these risks."
    >
      <DocSection heading="Meme coin risk">
        <p>
          Meme coins are extremely volatile and can lose all value. Most meme
          coins go to zero. Only commit what you can afford to lose entirely.
        </p>
      </DocSection>
      <DocSection heading="Tokenized stock asset risk">
        <p>
          Stock-token assets may provide economic exposure but do not
          represent direct ownership of underlying securities. They carry
          issuer, custody, tracking, and regulatory risks independent of the
          underlying equity. StockDotFun does not issue these assets.
        </p>
      </DocSection>
      <DocSection heading="Liquidity risk">
        <p>
          Bonding curves and reward routing depend on liquidity. Thin
          liquidity can make trading, fee conversion, and reward claims
          expensive, delayed, or temporarily impossible.
        </p>
      </DocSection>
      <DocSection heading="Smart contract risk">
        <p>
          Contracts can contain bugs. The StockDotFun contracts are an
          unaudited foundation until an independent audit is completed. Funds
          routed through them can be lost.
        </p>
      </DocSection>
      <DocSection heading="Jurisdiction risk">
        <p>
          Availability of the platform, tokenized stock assets, and rewards
          may vary by jurisdiction. You are responsible for compliance with
          your local laws.
        </p>
      </DocSection>
      <DocSection heading="Price feed risk">
        <p>
          Onchain price feeds can lag, fail, or be manipulated. Anything
          priced from a feed inherits those risks.
        </p>
      </DocSection>
      <DocSection heading="Routing / execution risk">
        <p>
          Fee conversion into stock-token assets depends on configurable
          router infrastructure. If no router is configured or execution
          fails, rewards may accrue in a different asset or be delayed.
        </p>
      </DocSection>
      <DocSection heading="No guaranteed rewards">
        <p>
          Holder and creator rewards depend entirely on trading activity and
          protocol configuration. They are never guaranteed, never fixed, and
          may be zero.
        </p>
      </DocSection>
      <DocSection heading="No financial advice · No affiliation">
        <p>
          Nothing on this platform is financial advice. StockDotFun is an
          independent platform built for Robinhood Chain and is not
          affiliated with Robinhood unless explicitly stated.
        </p>
      </DocSection>
    </DocShell>
  );
}
