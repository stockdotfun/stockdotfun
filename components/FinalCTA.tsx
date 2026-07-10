import Link from "next/link";
import { ArrowRight } from "lucide-react";
import MotionSection from "@/components/MotionSection";

export default function FinalCTA() {
  return (
    <section id="cta" className="relative overflow-hidden bg-primary py-24 sm:py-36">
      {/* subtle dark grid on green */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(4,16,10,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(4,16,10,0.08) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
        <MotionSection>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary-foreground/70">
            The meme launchpad built for tokenized market culture
          </p>
          <h2 className="mt-6 text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-primary-foreground sm:text-7xl lg:text-8xl">
            Launch on
            <span className="block font-serif italic tracking-[-0.02em]">
              Robinhood Chain.
            </span>
          </h2>
          <p className="mx-auto mt-7 max-w-xl text-lg font-medium text-primary-foreground/80">
            Launch memes. Pair markets. Reward communities.
          </p>
        </MotionSection>

        <MotionSection delay={0.12}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3.5">
            <Link
              href="/create"
              className="btn-sweep inline-flex items-center gap-2 rounded-full bg-primary-foreground px-9 py-4 text-[15px] font-semibold text-primary transition-transform hover:scale-[1.03] active:scale-[0.98]"
            >
              Launch a coin
              <ArrowRight size={16} strokeWidth={2.4} />
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 rounded-full border-2 border-primary-foreground/30 px-9 py-4 text-[15px] font-semibold text-primary-foreground transition-colors hover:border-primary-foreground hover:bg-primary-foreground/5"
            >
              Explore pairs
            </Link>
          </div>
          <p className="mt-8 font-mono text-[10px] uppercase tracking-widest text-primary-foreground/60">
            Not financial advice · Availability subject to supported assets,
            liquidity, jurisdiction, and protocol configuration
          </p>
        </MotionSection>
      </div>
    </section>
  );
}
