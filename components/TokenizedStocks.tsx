"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MotionSection from "@/components/MotionSection";
import StockLogo, { stockName } from "@/components/StockLogo";

const STOCKS = [
  { ticker: "TSLA", route: 40 },
  { ticker: "AAPL", route: 35 },
  { ticker: "NVDA", route: 45 },
  { ticker: "HOOD", route: 40 },
  { ticker: "SPY", route: 30 },
  { ticker: "PRIV", route: 25 },
];

const STEPS = [
  {
    n: "01",
    title: "Create the meme",
    detail: "Name, art, ticker — live in minutes. No seed liquidity required.",
  },
  {
    n: "02",
    title: "Pick the stock pair",
    detail: "Lock a Robinhood Chain Stock Token to your coin at launch.",
  },
  {
    n: "03",
    title: "Trade & earn",
    detail:
      "Fees fill a stock-token vault for holders. Creators earn in ETH or the stock.",
  },
];

export default function TokenizedStocks() {
  const [active, setActive] = useState(0);
  const stock = STOCKS[active];

  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden bg-background py-24 sm:py-32"
    >
      <div className="absolute inset-0 grid-bg" aria-hidden="true" />
      <div
        className="glow-pulse absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 50% 30%, rgba(0,200,5,0.1), transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <MotionSection className="text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-success">
            How it works
          </p>
          <h2 className="mx-auto mt-5 max-w-4xl text-4xl font-semibold leading-[1.02] tracking-[-0.03em] text-foreground sm:text-6xl lg:text-7xl">
            Real tokenized stocks.
            <span className="mt-1 block font-serif italic tracking-[-0.01em] text-primary">
              Actually onchain.
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-muted-foreground sm:text-lg">
            Robinhood Chain hosts Stock Tokens — ERC-20 assets that track real
            equities. StockDotFun plugs your meme coin straight into them:
            trading fees accumulate the paired stock token in a vault your
            holders can verify.
          </p>
        </MotionSection>

        {/* Pairing console */}
        <MotionSection delay={0.12}>
          <div className="mx-auto mt-14 max-w-3xl rounded-[28px] border border-border bg-card/90 p-6 shadow-[0_40px_120px_-40px_rgba(0,200,5,0.3)] sm:p-8">
            {/* live pair readout */}
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-background px-6 py-7 sm:flex-row sm:gap-6">
              <span className="rounded-full bg-primary px-4 py-2 font-mono text-[14px] font-bold text-primary-foreground">
                $YOURMEME
              </span>
              <span className="font-serif text-3xl italic text-muted-foreground">×</span>
              <AnimatePresence mode="wait">
                <motion.div
                  key={stock.ticker}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-3"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted text-foreground">
                    <StockLogo ticker={stock.ticker} size={20} brandColor />
                  </span>
                  <div className="text-left">
                    <p className="font-mono text-[15px] font-bold text-foreground">
                      {stock.ticker}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {stockName(stock.ticker)} · tokenized exposure
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait">
              <motion.p
                key={stock.ticker}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="mt-4 text-center font-mono text-[11px] uppercase tracking-wider text-success"
              >
                {stock.route}% of trading fees route to the {stock.ticker}{" "}
                holder vault*
              </motion.p>
            </AnimatePresence>

            {/* stock selector tiles */}
            <div className="mt-6 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
              {STOCKS.map((s, i) => (
                <motion.button
                  key={s.ticker}
                  type="button"
                  onClick={() => setActive(i)}
                  onMouseEnter={() => setActive(i)}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.96 }}
                  className={`group flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 ${
                    i === active
                      ? "border-primary/60 bg-primary/10"
                      : "border-border bg-muted hover:border-primary/30"
                  }`}
                >
                  <span
                    className={
                      i === active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                    }
                  >
                    <StockLogo ticker={s.ticker} size={22} brandColor={i === active} />
                  </span>
                  <span
                    className={`font-mono text-[11px] font-bold ${
                      i === active ? "text-success" : "text-muted-foreground"
                    }`}
                  >
                    {s.ticker}
                  </span>
                </motion.button>
              ))}
            </div>

            <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
              *Illustrative routing. PRIV = private-market exposure
              placeholder, subject to supported assets. Stock Tokens provide
              economic exposure — not direct ownership of underlying shares.
            </p>
          </div>
        </MotionSection>

        {/* three steps — the whole flow */}
        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <MotionSection key={s.n} delay={i * 0.08}>
              <div className="h-full rounded-2xl border border-border-soft bg-card/60 px-5 py-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
                <p className="font-mono text-[11px] text-primary">{s.n}</p>
                <p className="mt-1.5 text-[15px] font-semibold text-foreground">
                  {s.title}
                </p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {s.detail}
                </p>
              </div>
            </MotionSection>
          ))}
        </div>

        <MotionSection delay={0.2}>
          <p className="mt-10 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
            ERC-20 Stock Tokens · Onchain price feeds · 24/7 markets ·
            Independent, not affiliated with Robinhood — logos identify
            tokenized stock assets only
          </p>
        </MotionSection>
      </div>
    </section>
  );
}
