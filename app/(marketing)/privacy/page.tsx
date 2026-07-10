import type { Metadata } from "next";
import DocShell, { DocSection } from "@/components/layout/DocShell";

export const metadata: Metadata = {
  title: "Privacy policy",
};

/**
 * TEMPLATE — review with qualified counsel before launch.
 * This document is a starting point, not legal advice.
 */
export default function PrivacyPage() {
  return (
    <DocShell
      title="Privacy policy"
      subtitle="Template policy — subject to revision before launch. This page is not legal advice."
    >
      <DocSection heading="What we collect">
        <p>
          The interface reads your public wallet address when you connect and
          your theme preference (stored locally in your browser). We do not
          collect names, emails, or private keys.
        </p>
      </DocSection>
      <DocSection heading="Onchain data">
        <p>
          Blockchain transactions are public by design. Launches, trades, and
          claims associated with your address are visible to anyone,
          permanently.
        </p>
      </DocSection>
      <DocSection heading="Analytics">
        <p>
          If analytics are enabled in the future, they will be privacy-first
          and disclosed here before activation.
        </p>
      </DocSection>
      <DocSection heading="Third parties">
        <p>
          RPC providers, wallet extensions, and storage backends process
          requests according to their own policies. Review theirs alongside
          ours.
        </p>
      </DocSection>
      <DocSection heading="Contact">
        <p>
          Questions about this policy can be raised through the platform&apos;s
          official community channels.
        </p>
      </DocSection>
    </DocShell>
  );
}
