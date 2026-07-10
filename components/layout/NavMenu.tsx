"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { NAV_GROUPS } from "@/lib/nav";

/** Desktop nav with mega-menu dropdowns. Shared by public + app headers. */
export default function NavMenu() {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  return (
    <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
      {NAV_GROUPS.map((group) => {
        const active =
          pathname === group.href ||
          group.children?.some((c) => pathname === c.href.split("?")[0].split("#")[0]);
        const open = openGroup === group.label;
        return (
          <div
            key={group.label}
            className="relative"
            onMouseEnter={() => setOpenGroup(group.label)}
            onMouseLeave={() => setOpenGroup(null)}
          >
            <Link
              href={group.href}
              className={`flex items-center gap-1 rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {group.label}
              {group.children && (
                <ChevronDown
                  size={12}
                  className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                />
              )}
            </Link>

            <AnimatePresence>
              {open && group.children && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute left-1/2 top-full w-[300px] -translate-x-1/2 pt-2.5"
                >
                  <div className="overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-2xl shadow-black/20">
                    {group.children.map((child) => (
                      <Link
                        key={child.label}
                        href={child.href}
                        onClick={() => setOpenGroup(null)}
                        className="group/item flex flex-col gap-0.5 rounded-xl px-3.5 py-2.5 transition-colors hover:bg-muted"
                      >
                        <span className="text-[13.5px] font-semibold tracking-tight text-foreground group-hover/item:text-primary">
                          {child.label}
                        </span>
                        <span className="text-[11.5px] text-muted-foreground">
                          {child.description}
                        </span>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
}
