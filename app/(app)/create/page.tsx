import type { Metadata } from "next";
import CreateCoinWizard from "@/components/platform/CreateCoinWizard";

export const metadata: Metadata = {
  title: "Create a coin",
  description: "Launch a Robinhood Chain meme coin paired with a supported Stock Token.",
};

export default function CreatePage() {
  return (
    <div>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-[-0.02em] text-foreground">
          Create a coin
        </h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Pick the meme, pick the pair, launch. The protocol handles routing.
        </p>
      </div>
      <div className="mt-8">
        <CreateCoinWizard />
      </div>
    </div>
  );
}
