"use client";

import { motion } from "framer-motion";
import MotionSection from "@/components/MotionSection";
import StockLogo from "@/components/StockLogo";
import CountUp from "@/components/anim/CountUp";
import AnimatedBar from "@/components/anim/AnimatedBar";

const ROWS = [
  { meme: "$ROCKET", stock: "TSLA", price: "0.00042", vol: "412K", pool: "18.4K", grad: 63, creator: "2.1K" },
  { meme: "$GPUINU", stock: "NVDA", price: "0.00118", vol: "1.2M", pool: "31.7K", grad: 88, creator: "5.4K" },
  { meme: "$ORCHARD", stock: "AAPL", price: "0.00027", vol: "268K", pool: "9.1K", grad: 41, creator: "1.3K" },
  { meme: "$HOODIE", stock: "HOOD", price: "0.00061", vol: "733K", pool: "12.9K", grad: 72, creator: "3.0K" },
  { meme: "$SPYDER", stock: "SPY", price: "0.00013", vol: "154K", pool: "6.2K", grad: 22, creator: "0.8K" },
];

export default function FeaturedPairs() {
  return (
    <section
      id="pairs"
      className="relative overflow-hidden bg-background py-24 sm:py-32"
    >
      <div className="absolute inset-0 grid-bg" aria-hidden="true" />
      <div
        className="glow-pulse absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 45% at 50% 10%, rgba(0,200,5,0.08), transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <MotionSection className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-success">
              Launchpad strip
            </p>
            <h2 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-6xl">
              The market strip,
              <span className="mt-1 block font-serif italic text-success">
                live from the launchpad.
              </span>
            </h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary tick-dot" />
            Illustrative preview data
          </span>
        </MotionSection>

        <MotionSection delay={0.1}>
          <div className="mt-10 overflow-hidden rounded-3xl border border-border bg-card/90">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left font-mono text-[12.5px]">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
                    <th className="px-5 py-4 font-medium">Pair</th>
                    <th className="px-5 py-4 font-medium">Price</th>
                    <th className="px-5 py-4 font-medium">24h Vol</th>
                    <th className="px-5 py-4 font-medium">Reward pool</th>
                    <th className="px-5 py-4 font-medium">Graduation</th>
                    <th className="px-5 py-4 font-medium text-right">
                      Creator rewards
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row, i) => (
                    <motion.tr
                      key={row.meme}
                      initial={{ opacity: 0, y: 14 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{
                        duration: 0.5,
                        delay: i * 0.07,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="border-b border-border-soft transition-colors last:border-0 hover:bg-muted/70"
                    >
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-2.5">
                          <span className="font-semibold text-foreground">
                            {row.meme}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted text-foreground">
                            <StockLogo ticker={row.stock} size={11} brandColor />
                          </span>
                          <span className="text-foreground">{row.stock}</span>
                        </span>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {row.price}
                      </td>
                      <td className="px-5 py-4 text-foreground">{row.vol}</td>
                      <td className="px-5 py-4 text-success">{row.pool}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <AnimatedBar
                            pct={row.grad}
                            delay={i * 0.07 + 0.15}
                            className="h-1.5 w-24 bg-border-soft"
                            barClassName="bg-primary"
                          />
                          <CountUp
                            value={row.grad}
                            suffix="%"
                            duration={1.1}
                            className="text-[11px] text-muted-foreground"
                          />
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right text-foreground">
                        {row.creator}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border-soft px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Values shown are illustrative preview data for the landing page.
            </p>
          </div>
        </MotionSection>
      </div>
    </section>
  );
}
