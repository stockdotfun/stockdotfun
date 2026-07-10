"use client";

import { motion } from "framer-motion";

/** Progress bar that fills from 0 → pct% when scrolled into view. */
export default function AnimatedBar({
  pct,
  className,
  barClassName,
  delay = 0,
}: {
  pct: number;
  className?: string;
  barClassName?: string;
  delay?: number;
}) {
  return (
    <div className={`overflow-hidden rounded-full ${className ?? ""}`}>
      <motion.div
        className={`h-full rounded-full ${barClassName ?? ""}`}
        initial={{ width: 0 }}
        whileInView={{ width: `${pct}%` }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 1, delay, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
