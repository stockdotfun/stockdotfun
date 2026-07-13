/** Compact number for chart axes/legends (no currency symbol): 2.14K, 8.40M. */
export function compact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  if (a >= 1) return n.toFixed(2);
  if (a > 0) return n.toPrecision(3);
  return "0";
}

/** USD money, pump.fun-style: $2.14K, $8.40M, $12.34. */
export function formatUsd(n?: number | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  return `$${compact(n)}`;
}
