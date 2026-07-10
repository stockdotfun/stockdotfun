"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Rocket } from "lucide-react";
import { NAV_GROUPS } from "@/lib/nav";
import ConnectWalletButton from "@/components/platform/ConnectWalletButton";

/** Slide-down mobile menu shared by both headers. Parent controls `open`. */
export default function MobileNav({
  open,
  onNavigate,
}: {
  open: boolean;
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden border-t border-border-soft bg-background/95 backdrop-blur-xl lg:hidden"
        >
          <div className="max-h-[calc(100dvh-70px)] overflow-y-auto px-5 pb-8 pt-2">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="border-b border-border-soft">
                <button
                  type="button"
                  onClick={() =>
                    setExpanded(expanded === group.label ? null : group.label)
                  }
                  className="flex w-full items-center justify-between py-3.5 text-[15px] font-semibold text-foreground"
                  aria-expanded={expanded === group.label}
                >
                  {group.label}
                  <ChevronDown
                    size={16}
                    className={`text-muted-foreground transition-transform ${
                      expanded === group.label ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {expanded === group.label && group.children && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-1 pb-3.5">
                        {group.children.map((child) => (
                          <Link
                            key={child.label}
                            href={child.href}
                            onClick={onNavigate}
                            className="rounded-xl px-3 py-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            <div className="mt-5 flex flex-col gap-3">
              <Link
                href="/create"
                onClick={onNavigate}
                className="btn-sweep flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-[14.5px] font-semibold text-primary-foreground"
              >
                <Rocket size={16} />
                Create Coin
              </Link>
              <div className="flex justify-center">
                <ConnectWalletButton />
              </div>
            </div>
            <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Built for Robinhood Chain
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
