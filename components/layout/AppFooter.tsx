import Link from "next/link";

/** Slim footer for app pages — disclaimer + essential links only. */
export default function AppFooter() {
  return (
    <footer className="border-t border-border-soft bg-background">
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
            Stock-token assets may provide economic exposure but do not
            represent direct ownership of underlying securities. Rewards
            depend on activity and protocol configuration — never guaranteed.
            Not financial advice.
          </p>
          <div className="flex shrink-0 gap-4 font-mono text-[10.5px] uppercase tracking-wider">
            <Link href="/risk" className="text-muted-foreground hover:text-primary">
              Risk
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-primary">
              Terms
            </Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-primary">
              Privacy
            </Link>
            <Link
              href="/docs/how-it-works"
              className="text-muted-foreground hover:text-primary"
            >
              Docs
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
