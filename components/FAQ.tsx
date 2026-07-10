"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import MotionSection from "@/components/MotionSection";

const FAQS = [
  {
    q: "Is StockDotFun live?",
    a: "Yes — StockDotFun is launch-ready on Robinhood Chain. Connect a wallet, create a coin, and pick a stock pair. Early launches roll out in waves; grab launch updates below to get in first.",
  },
  {
    q: "Are holders receiving actual stocks?",
    a: "No. Rewards are paid in supported tokenized stock assets on Robinhood Chain — the same Stock Tokens Robinhood Chain already hosts. They may provide economic exposure but are not direct ownership of underlying company shares.",
  },
  {
    q: "Can creators choose ETH rewards?",
    a: "Yes. Creator rewards can be routed in ETH or the selected stock-token asset (or auto-split), depending on liquidity, compliance, and technical availability.",
  },
  {
    q: "Is this affiliated with Robinhood?",
    a: "No, unless officially announced. StockDotFun is an independent platform built on Robinhood Chain, composing with the Stock Token assets that live there.",
  },
];

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faq" className="relative bg-muted py-20 sm:py-28">
      <div className="relative mx-auto max-w-4xl px-5 sm:px-8">
        <MotionSection className="text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            FAQ
          </p>
          <h2 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-6xl">
            Questions,
            <span className="font-serif italic text-primary">
              {" "}
              answered plainly.
            </span>
          </h2>
        </MotionSection>

        <MotionSection delay={0.1}>
          <div className="mt-12 divide-y divide-border rounded-3xl border border-border bg-card/70">
            {FAQS.map((faq, i) => {
              const open = openIdx === i;
              return (
                <div key={faq.q}>
                  <button
                    type="button"
                    onClick={() => setOpenIdx(open ? null : i)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span className="text-[15.5px] font-semibold tracking-tight text-foreground">
                      {faq.q}
                    </span>
                    <motion.span
                      animate={{ rotate: open ? 45 : 0 }}
                      transition={{ duration: 0.25 }}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        open ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Plus size={15} strokeWidth={2.4} />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="px-6 pb-6 text-[14.5px] leading-relaxed text-muted-foreground">
                          {faq.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </MotionSection>
      </div>
    </section>
  );
}
