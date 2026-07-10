"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, Rocket } from "lucide-react";
import Logo from "@/components/Logo";
import RobinhoodMark from "@/components/RobinhoodMark";
import NavMenu from "@/components/layout/NavMenu";
import MobileNav from "@/components/layout/MobileNav";
import ThemeToggle from "@/components/layout/ThemeToggle";
import ConnectWalletButton from "@/components/platform/ConnectWalletButton";
import MarketTicker from "@/components/platform/MarketTicker";

/** App header: solid surface, denser, with the market ticker strip below. */
export default function AppHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50">
      <div
        className={`border-b border-border-soft bg-background/90 backdrop-blur-xl transition-shadow duration-300 ${
          scrolled ? "shadow-[0_8px_30px_-16px_rgba(0,0,0,0.4)]" : ""
        }`}
      >
        <div
          className={`mx-auto flex max-w-7xl items-center justify-between px-5 transition-all duration-300 sm:px-8 ${
            scrolled ? "h-[52px]" : "h-16"
          }`}
        >
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="StockDotFun home">
              <Logo />
            </Link>
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-success xl:inline-flex">
              <RobinhoodMark size={11} brand />
              Robinhood Chain
            </span>
          </div>

          <NavMenu />

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <div className="hidden sm:block">
              <ConnectWalletButton compact />
            </div>
            <Link
              href="/create"
              className="btn-sweep hidden h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-transform hover:scale-[1.03] md:inline-flex"
            >
              <Rocket size={13} />
              Create Coin
            </Link>
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground lg:hidden"
            >
              {open ? <X size={17} /> : <Menu size={17} />}
            </button>
          </div>
        </div>
        <MobileNav open={open} onNavigate={() => setOpen(false)} />
      </div>
      <MarketTicker />
    </header>
  );
}
