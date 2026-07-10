import type { Metadata } from "next";
import DocShell, { DocSection } from "@/components/layout/DocShell";

export const metadata: Metadata = {
  title: "Terms of use",
};

/**
 * TEMPLATE — review with qualified counsel before launch.
 * This document is a starting point, not legal advice.
 */
export default function TermsPage() {
  return (
    <DocShell
      title="Terms of use"
      subtitle="Template terms — subject to revision before launch. This page is not legal advice."
    >
      <DocSection heading="1. Acceptance">
        <p>
          By accessing StockDotFun you agree to these terms, the privacy
          policy, and the risk disclosure. If you do not agree, do not use
          the platform.
        </p>
      </DocSection>
      <DocSection heading="2. The platform">
        <p>
          StockDotFun is a non-custodial interface to smart contracts on
          Robinhood Chain. We do not hold user funds, issue tokenized stocks,
          execute trades on your behalf, or guarantee any reward, price, or
          outcome.
        </p>
      </DocSection>
      <DocSection heading="3. Eligibility">
        <p>
          You are responsible for ensuring your use is lawful in your
          jurisdiction. The platform, supported assets, and rewards may be
          unavailable or restricted where you live.
        </p>
      </DocSection>
      <DocSection heading="4. User content and launches">
        <p>
          You are solely responsible for tokens you create, including names,
          images, and descriptions. Do not launch content that infringes
          rights, impersonates others, or violates law. We may de-list
          content from the interface at our discretion.
        </p>
      </DocSection>
      <DocSection heading="5. No advice">
        <p>
          Nothing on the platform is investment, legal, accounting, or tax
          advice. Meme coins can lose all value.
        </p>
      </DocSection>
      <DocSection heading="6. Limitation of liability">
        <p>
          To the maximum extent permitted by law, StockDotFun and its
          contributors are not liable for losses arising from use of the
          platform, smart contracts, third-party assets, or network failures.
        </p>
      </DocSection>
      <DocSection heading="7. Changes">
        <p>
          We may update these terms. Continued use after changes constitutes
          acceptance.
        </p>
      </DocSection>
    </DocShell>
  );
}
