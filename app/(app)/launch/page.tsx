import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Rocket, Combine, Repeat } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import PlatformStatus from "@/components/platform/PlatformStatus";

export const metadata: Metadata = {
  title: "Launch",
  description: "Create meme. Choose stock pair. Launch on Robinhood Chain.",
};

const STEPS = [
  {
    icon: Rocket,
    title: "Create the meme",
    body: "Name, art, ticker. Live in minutes — no seed liquidity required.",
  },
  {
    icon: Combine,
    title: "Choose the stock pair",
    body: "Pick a supported Robinhood Chain Stock Token. Locked in at launch.",
  },
  {
    icon: Repeat,
    title: "Trade, route, reward",
    body: "Fees can route to the holder stock-token vault, creator rewards, and the protocol.",
  },
];

export default function LaunchPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex justify-center">
        <PlatformStatus />
      </div>
      <div className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-success">
          Launch
        </p>
        <h1 className="mt-4 text-4xl font-semibold leading-[1.03] tracking-[-0.03em] text-foreground sm:text-5xl">
          Create meme. Choose stock pair.
          <span className="mt-1 block font-serif italic text-primary">
            Launch.
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Simple launch flow. Real market rails. Every trade can route value
          into the pair — for eligible holders and for you as the creator.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/create"
            className="btn-sweep inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-[14.5px] font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
          >
            Start creating
            <ArrowRight size={15} strokeWidth={2.4} />
          </Link>
          <Link
            href="/docs/how-it-works"
            className="inline-flex items-center rounded-full border border-border px-8 py-3.5 text-[14.5px] font-semibold text-foreground transition-colors hover:border-primary/50"
          >
            How launching works
          </Link>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <Card key={s.title}>
            <CardBody>
              <s.icon size={20} className="text-primary" strokeWidth={1.8} />
              <p className="mt-3 font-mono text-[10px] text-primary">
                0{i + 1}
              </p>
              <h2 className="mt-1 text-[15px] font-semibold tracking-tight text-foreground">
                {s.title}
              </h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      <p className="mt-10 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
        Stock-token assets provide economic exposure, not direct ownership of
        underlying securities · Rewards are never guaranteed
      </p>
    </div>
  );
}
