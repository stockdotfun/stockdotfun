"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import MotionSection from "@/components/MotionSection";
import CountUp from "@/components/anim/CountUp";
import AnimatedBar from "@/components/anim/AnimatedBar";

const SPLITS = [
  { label: "Stock-token vault (holders)", pct: 40, cls: "bg-primary" },
  { label: "Holder reward route", pct: 30, cls: "bg-success/70" },
  { label: "Creator reward stream", pct: 20, cls: "bg-emerald-800" },
  { label: "Protocol fee", pct: 10, cls: "bg-border" },
];

const PREFS = ["ETH", "Stock token", "Auto-split"] as const;

export default function Rewards() {
  const [pref, setPref] = useState<(typeof PREFS)[number]>("ETH");

  return (
    <section id="rewards" className="relative overflow-hidden bg-background py-24 sm:py-32">
      <div className="absolute inset-0 grid-bg" aria-hidden="true" />
      <div
        className="glow-pulse absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 40% at 50% 15%, rgba(0,200,5,0.09), transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <MotionSection className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-success">
            Rewards
          </p>
          <h2 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-6xl">
            Every trade feeds the pair.
            <span className="mt-1 block font-serif italic text-primary">
              Holders stack stock. Creators route capital.
            </span>
          </h2>
        </MotionSection>

        <div className="mt-14 grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
          {/* Holder panel */}
          <MotionSection y={30} className="h-full">
            <div className="flex h-full flex-col rounded-[28px] border border-border bg-card p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-widest text-success">
                  For holders · Demo
                </p>
                <span className="h-2 w-2 rounded-full bg-primary tick-dot" />
              </div>

              <div className="mt-5 rounded-2xl border border-border bg-muted p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Meme balance
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                  <CountUp value={1240000} duration={1.6} />{" "}
                  <span className="text-[14px] font-medium text-success">
                    $ROCKET
                  </span>
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border bg-muted p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Eligible pool
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    <CountUp value={18.4} decimals={1} suffix="K*" />
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-muted p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Stock pair
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">TSLA</p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-border bg-muted p-4">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Eligibility progress
                  </p>
                  <CountUp
                    value={63}
                    suffix="%"
                    className="font-mono text-[10px] text-success"
                  />
                </div>
                <AnimatedBar
                  pct={63}
                  delay={0.2}
                  className="mt-2 h-2 w-full bg-border-soft"
                  barClassName="bg-primary"
                />
              </div>

              <div className="mt-auto pt-4">
                <button
                  type="button"
                  className="btn-sweep flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-[13.5px] font-semibold text-primary-foreground transition-transform hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Sparkles size={14} />
                  Claim rewards
                </button>
              </div>
            </div>
          </MotionSection>

          {/* Creator panel */}
          <MotionSection y={30} delay={0.1} className="h-full">
            <div className="flex h-full flex-col rounded-[28px] border border-border bg-card p-6 sm:p-7">
              <p className="font-mono text-[10px] uppercase tracking-widest text-success">
                For creators · Illustrative split
              </p>

              <div className="mt-5 space-y-3.5">
                {SPLITS.map((s, i) => (
                  <div key={s.label}>
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="text-muted-foreground">{s.label}</span>
                      <CountUp
                        value={s.pct}
                        suffix="%"
                        className="font-mono text-foreground"
                      />
                    </div>
                    <AnimatedBar
                      pct={s.pct}
                      delay={i * 0.1}
                      className="mt-1.5 h-2 w-full bg-border-soft"
                      barClassName={s.cls}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t border-border-soft pt-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Creator reward preference
                </p>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {PREFS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPref(p)}
                      className={`rounded-xl px-2 py-2.5 text-[11.5px] font-medium leading-tight transition-colors ${
                        pref === p
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-muted text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
                  Creator rewards route in ETH or the paired stock token,
                  depending on liquidity, compliance, and availability.
                </p>
              </div>
            </div>
          </MotionSection>
        </div>

        <MotionSection delay={0.15}>
          <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
            *Demo values · Rewards depend on activity and protocol
            configuration — never guaranteed
          </p>
        </MotionSection>
      </div>
    </section>
  );
}
