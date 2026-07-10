import Link from "next/link";
import Image from "next/image";
import Logo from "@/components/Logo";
import RobinhoodMark from "@/components/RobinhoodMark";

const LINK_GROUPS = [
  {
    title: "Platform",
    links: [
      { label: "Launch", href: "/launch" },
      { label: "Explore", href: "/explore" },
      { label: "Rewards", href: "/rewards" },
      { label: "Portfolio", href: "/portfolio" },
      { label: "Docs", href: "/docs/how-it-works" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "Risk Disclosure", href: "/risk" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "X / Twitter", href: "https://x.com" },
      { label: "Telegram", href: "https://telegram.org" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-border-soft bg-background">
      <div className="relative mx-auto max-w-7xl px-5 pt-16 sm:px-8">
        <div className="grid grid-cols-1 gap-12 pb-14 md:grid-cols-[1.2fr_2fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-muted-foreground">
              The launchpad for market-native memes, built on Robinhood
              Chain.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-success">
              <RobinhoodMark size={11} brand />
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary tick-dot" />
                Live on Robinhood Chain
              </span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {LINK_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {group.title}
                </p>
                <ul className="mt-4 space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-[13.5px] text-foreground/80 transition-colors hover:text-primary"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border-soft py-8">
          <p className="max-w-4xl text-[11.5px] leading-relaxed text-muted-foreground">
            StockDotFun is an experimental launchpad built for Robinhood
            Chain. Tokenized stock assets may provide economic exposure but do
            not represent direct ownership of underlying securities, and may
            be restricted by jurisdiction. Availability, rewards, routing, and
            supported assets may vary by jurisdiction and protocol
            configuration. Nothing on this site is financial advice.
          </p>
          <p className="mt-3 max-w-4xl text-[11.5px] leading-relaxed text-muted-foreground/80">
            All third-party trademarks, logos, and brand names are the
            property of their respective owners and are used for
            identification of tokenized stock assets only.
          </p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            © 2026 StockDotFun · Independent · Not affiliated with Robinhood
            unless officially stated
          </p>
        </div>
      </div>

      {/* Market-meme celebration strip — Wall Street party energy */}
      <div
        className="relative mt-8 h-[clamp(190px,24vw,340px)] w-full overflow-hidden select-none"
        aria-hidden="true"
      >
        <Image
          src="/images/wall-street-celebration.jpg"
          alt="Wall Street celebration"
          fill
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: "center 40%" }}
        />
        {/* fade top + sides into the footer background so the strip blends */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, var(--background) 0%, transparent 26%, transparent 72%, var(--background) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, var(--background), transparent 14%, transparent 86%, var(--background))",
          }}
        />
      </div>

      {/* Giant brand sign-off */}
      <div
        className="relative -mt-[3vw] h-[16vw] min-h-[90px] overflow-hidden select-none"
        aria-hidden="true"
      >
        <p className="absolute inset-x-0 bottom-0 whitespace-nowrap text-center text-[17.5vw] font-semibold leading-[0.78] tracking-[-0.05em] text-foreground">
          Stock
          <span className="mx-[0.6vw] inline-block h-[2.2vw] w-[2.2vw] min-h-[12px] min-w-[12px] rounded-full bg-primary align-middle tick-dot" />
          Fun
        </p>
      </div>
    </footer>
  );
}
