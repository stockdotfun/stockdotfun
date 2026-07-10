"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import MotionSection from "@/components/MotionSection";
import HeroVideoBackground from "@/components/hero/HeroVideoBackground";

const PAIRS = [
  { meme: "$DOGECEO", stock: "TSLA", change: "+18.4%", curve: 63 },
  { meme: "$GPUINU", stock: "NVDA", change: "+9.8%", curve: 88 },
  { meme: "$HOODIE", stock: "HOOD", change: "+21.6%", curve: 72 },
  { meme: "$SPYDER", stock: "SPY", change: "+2.4%", curve: 22 },
];

const TRUST_PILLS = [
  "Built for Robinhood Chain",
  "Stock-token reward layer",
  "Creator rewards",
  "No seed liquidity required",
  "Meme culture + market exposure",
];

/* Convergence chart geometry (viewBox 1440x320).
   The volatile meme line and the calm stock line meet at (1180, 110) —
   the "graduation" point — then continue as one paired line. */
const MEME_PATH =
  "M0 250 L80 230 L140 262 L220 210 L280 236 L360 180 L430 214 L520 160 L600 190 L690 140 L780 168 L870 120 L960 148 L1060 118 L1180 110";
const STOCK_PATH = "M0 170 C 300 152, 720 138, 1180 110";
const PAIRED_PATH = "M1180 110 L1260 98 L1330 112 L1400 92 L1440 96";

function ConvergenceChart({ stock }: { stock: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[140px] sm:h-[180px] lg:h-[210px]">
      <svg
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        className="h-full w-full"
        fill="none"
        aria-hidden="true"
      >
        {/* glow under the meme line */}
        <path
          d={MEME_PATH}
          stroke="var(--primary)"
          strokeWidth="10"
          opacity="0.1"
          strokeLinejoin="round"
        />
        {/* meme line: volatile */}
        <path
          d={MEME_PATH}
          stroke="var(--primary)"
          strokeWidth="2.5"
          opacity="0.85"
          strokeLinejoin="round"
        />
        {/* stock line: calm */}
        <path
          d={STOCK_PATH}
          stroke="var(--foreground)"
          strokeWidth="1.5"
          opacity="0.35"
          className="flow-line"
        />
        {/* after graduation, they trade as one */}
        <path
          d={PAIRED_PATH}
          stroke="var(--success)"
          strokeWidth="2"
          opacity="0.55"
          strokeLinejoin="round"
        />

        {/* travelling ticks — both arrive at the meet point together */}
        <circle r="5" fill="var(--primary)">
          <animateMotion dur="7s" repeatCount="indefinite" path={MEME_PATH} />
        </circle>
        <circle r="4" fill="var(--foreground)" opacity="0.7">
          <animateMotion dur="7s" repeatCount="indefinite" path={STOCK_PATH} />
        </circle>

        {/* graduation pulse */}
        <circle cx="1180" cy="110" r="6" fill="var(--primary)" />
        <circle cx="1180" cy="110" r="6" stroke="var(--primary)" strokeWidth="1.5">
          <animate attributeName="r" values="6;30" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.7;0" dur="2.4s" repeatCount="indefinite" />
        </circle>
      </svg>

      {/* graduation chip pinned to the meet point (1180/1440, 110/320) */}
      <div
        className="absolute hidden -translate-x-1/2 translate-y-1/2 sm:block"
        style={{ left: "81.9%", bottom: "65.6%" }}
      >
        <div className="mb-3 rounded-lg border border-primary/30 bg-background/90 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-success backdrop-blur">
          Graduation → {stock} vault
        </div>
      </div>

      {/* axis labels */}
      <span className="absolute bottom-3 left-5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 sm:left-8">
        Meme curve
      </span>
      <span className="absolute bottom-3 right-5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 sm:right-8">
        Paired market · Demo
      </span>
    </div>
  );
}

export type HeroVideoSources = {
  src?: string;
  webmSrc?: string;
  poster: string;
};

export default function Hero({ video }: { video?: HeroVideoSources }) {
  const ref = useRef<HTMLElement>(null);
  const [idx, setIdx] = useState(0);
  const pair = PAIRS[idx];

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % PAIRS.length), 3800);
    return () => clearInterval(t);
  }, []);

  /* cursor parallax: ghost ticker drifts with the cursor, chart drifts against it */
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const ghostX = useSpring(useTransform(mx, (v) => v * 26), {
    stiffness: 60,
    damping: 18,
  });
  const ghostY = useSpring(useTransform(my, (v) => v * 14), {
    stiffness: 60,
    damping: 18,
  });
  const chartX = useSpring(useTransform(mx, (v) => v * -10), {
    stiffness: 60,
    damping: 18,
  });

  const onMouseMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };

  return (
    <section
      ref={ref}
      onMouseMove={onMouseMove}
      className="relative flex h-[100svh] min-h-[600px] flex-col justify-center overflow-hidden bg-background pt-[88px] pb-[150px] sm:pb-[190px] lg:pb-[210px]"
    >
      {/* Layer 1: base color comes from the section's bg-background. */}
      {/* Layer 2: cinematic Wall Street video (poster fallback until the
          video file ships — see public/videos/README.md). */}
      {video && (
        <HeroVideoBackground
          src={video.src}
          webmSrc={video.webmSrc}
          poster={video.poster}
          opacity={0.55}
        />
      )}
      {/* Layer 3: dark overlay for headline contrast (dark mode only —
          the light hero stays ivory and uses the halved video opacity). */}
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.72), rgba(0,0,0,0.55), rgba(0,0,0,0.9))",
        }}
        aria-hidden="true"
      />
      {/* Layer 4: green radial glow tuned to the brand. */}
      <div
        className="absolute inset-0 opacity-50 dark:opacity-100"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, rgba(0,255,65,0.14), transparent 45%)",
        }}
        aria-hidden="true"
      />
      {/* Layers 5-6: existing terminal grid + pulsing glow. */}
      <div className="absolute inset-0 grid-bg" aria-hidden="true" />
      <div className="glow-pulse absolute inset-0 glow-primary" aria-hidden="true" />

      {/* Ghost pair readout — the market breathing behind the headline */}
      <motion.div
        style={{ x: ghostX, y: ghostY }}
        className="pointer-events-none absolute inset-x-0 top-[20%] select-none text-center sm:top-[24%]"
        aria-hidden="true"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={pair.meme}
            initial={{ opacity: 0, y: 26, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -26, filter: "blur(8px)" }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="whitespace-nowrap font-mono text-[13vw] font-medium leading-none tracking-tighter text-foreground/[0.15] sm:text-[9.5vw]">
              {pair.meme}
              <span className="mx-[1.5vw] text-primary/35">×</span>
              <span className="text-foreground/20">{pair.stock}</span>
            </p>
            <div className="mt-[1.5vw] flex items-center justify-center gap-[4vw] font-mono text-[3.2vw] tracking-tight sm:mt-[0.8vw] sm:text-[1.7vw]">
              <span className="text-primary/50">▲ {pair.change} today</span>
              <span className="text-foreground/25">
                curve {pair.curve}% · graduation
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Headline layer */}
      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 text-center sm:px-8">
        <MotionSection>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/80 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-success backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-primary tick-dot" />
            Live on Robinhood Chain · Memes × tokenized stocks
          </span>
        </MotionSection>

        <MotionSection delay={0.1}>
          <h1 className="mt-5">
            <span className="block text-[12vw] font-semibold leading-[0.95] tracking-[-0.04em] text-foreground sm:text-[66px] lg:text-[82px]">
              Launch the meme.
            </span>
            <span
              className="mt-0.5 block text-[14vw] italic leading-[1.02] tracking-[-0.02em] text-primary sm:text-[78px] lg:text-[98px]"
              style={{ fontFamily: "var(--font-instrument-serif)" }}
            >
              Pair the market.
            </span>
          </h1>
        </MotionSection>

        <MotionSection delay={0.2}>
          <p className="mx-auto mt-5 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground sm:text-[16.5px]">
            StockDotFun lets creators launch Robinhood Chain meme coins that
            can route trading fees into tokenized stock rewards for holders —
            and creator rewards in ETH or supported stock tokens.
          </p>
        </MotionSection>

        <MotionSection delay={0.28}>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3.5">
            <Link
              href="/create"
              className="btn-sweep inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-[15px] font-semibold text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]"
            >
              Launch a coin
              <ArrowRight size={16} strokeWidth={2.4} />
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-8 py-4 text-[15px] font-semibold text-foreground backdrop-blur transition-colors hover:border-primary/50 hover:bg-muted"
            >
              Explore pairs
            </Link>
          </div>
        </MotionSection>

        <MotionSection delay={0.36}>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {TRUST_PILLS.map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-border-soft bg-card/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
              >
                {pill}
              </span>
            ))}
          </div>
        </MotionSection>
      </div>

      {/* Convergence chart — meme line meets stock line, graduates, trades on */}
      <motion.div style={{ x: chartX }} className="absolute inset-x-0 bottom-0">
        <ConvergenceChart stock={pair.stock} />
      </motion.div>
    </section>
  );
}
