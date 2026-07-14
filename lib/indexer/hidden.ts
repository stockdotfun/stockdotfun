/**
 * Hidden tokens — addresses suppressed everywhere in the UI (Explore, token
 * pages, creator page, on-chain freshness layer).
 *
 * The launch factory (StockDotFunFactoryV2) is immutable and its token list is
 * append-only, so a token can never be removed on-chain. A denylist is how
 * test/spam coins are hidden from the app — the same approach pump.fun and other
 * launchpads use. Baked-in defaults are the pre-launch TEST tokens; add more at
 * deploy time via NEXT_PUBLIC_HIDDEN_TOKENS (comma-separated) with no code change.
 */
const DEFAULT_HIDDEN = [
  "0xc8a5345bFD37f5EdD92684CCFEbF8a9f35249957", // TEST
  "0x88F8fd69bc5E56A3DA245e40b1311BCdCd7fe3d0", // TEST
  "0x90f60ec589455Fd857461b845F0AB495240974F5", // TEST
  "0x1Cec1a05f6A99D008b0a848a74D540eA2636CA9d", // TEST2
  "0xFc86E15c7cF4F8C52A0fB497d49fDFdaE4E98898", // TEST3
  "0xaa69638d15dE2a679645845f177530481a4938F0", // TEST4
  "0xb162B425C17DD742552b6a494Dd36aae8342D930", // TEST5
  "0xA10c1b0a96ee3cC512Fc370379DaF49b53681aF4", // TEST6
  "0xC0F30083d0FDfFe43Ce643740067ab8578b51C78", // TEST
];

const envHidden = (process.env.NEXT_PUBLIC_HIDDEN_TOKENS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const HIDDEN_TOKENS = new Set(
  [...DEFAULT_HIDDEN, ...envHidden].map((a) => a.toLowerCase()),
);

/** True when a token address is on the denylist and must not be shown. */
export function isHiddenToken(address?: string): boolean {
  return !!address && HIDDEN_TOKENS.has(address.toLowerCase());
}
