"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const DOC_LINKS = [
  { label: "How it works", href: "/docs/how-it-works" },
  { label: "Supported assets", href: "/docs/supported-assets" },
  { label: "Fees", href: "/docs/fees" },
  { label: "Contracts", href: "/docs/contracts" },
  { label: "Risk disclosure", href: "/risk" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
];

/** Shared shell for docs + legal pages: sidebar nav, prose column. */
export default function DocShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-[110px] sm:px-8">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[200px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Documentation
          </p>
          <nav className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto lg:flex-col">
            {DOC_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors lg:rounded-xl ${
                  pathname === l.href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl">
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          )}
          <div className="mt-8 space-y-8">{children}</div>
        </article>
      </div>
    </div>
  );
}

export function DocSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {heading}
      </h2>
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-muted-foreground [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}
