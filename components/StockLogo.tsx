import {
  SiTesla,
  SiApple,
  SiNvidia,
  SiSpacex,
  type IconType,
} from "@icons-pack/react-simple-icons";
import RobinhoodMark from "@/components/RobinhoodMark";

type Entry = { Icon?: IconType; brand: string; name: string };

const MAP: Record<string, Entry> = {
  TSLA: { Icon: SiTesla, brand: "#E82127", name: "Tesla" },
  AAPL: { Icon: SiApple, brand: "var(--foreground)", name: "Apple" },
  NVDA: { Icon: SiNvidia, brand: "#76B900", name: "NVIDIA" },
  HOOD: { brand: "var(--brand-robinhood)", name: "Robinhood" },
  PRIV: { Icon: SiSpacex, brand: "var(--foreground)", name: "Private markets" },
  SPY: { brand: "var(--foreground)", name: "S&P 500" },
};

export function stockName(ticker: string) {
  return MAP[ticker]?.name ?? ticker;
}

type StockLogoProps = {
  ticker: string;
  size?: number;
  /** true = official brand color, false = inherit currentColor */
  brandColor?: boolean;
  className?: string;
};

/** Official stock brand mark; falls back to a ticker badge (e.g. SPY). */
export default function StockLogo({
  ticker,
  size = 18,
  brandColor = false,
  className,
}: StockLogoProps) {
  // HOOD renders the official Robinhood feather (public/Robinhood Logos/*),
  // theme-aware via --brand-robinhood: black on light, neon on dark.
  if (ticker === "HOOD") {
    return (
      <RobinhoodMark size={size} brand={brandColor} className={className} />
    );
  }

  const entry = MAP[ticker];
  if (entry?.Icon) {
    return (
      <entry.Icon
        size={size}
        color={brandColor ? entry.brand : "currentColor"}
        className={className}
        title={entry.name}
      />
    );
  }
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border border-current font-mono font-bold ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(7, size * 0.28),
        letterSpacing: "0.02em",
      }}
    >
      {ticker.slice(0, 3)}
    </span>
  );
}
