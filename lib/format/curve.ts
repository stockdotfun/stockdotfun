/**
 * Bonding-curve graduation progress, shared by the token page, Explore cards,
 * and the table. Progress can be fractional (e.g. 0.02%), so show 2 decimals
 * under 1% instead of flooring to "0", and give the bar a small minimum width
 * so a real-but-tiny amount is still visible.
 */
export function curveProgressLabel(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return "0";
  if (p >= 1) return p.toFixed(0);
  return p.toFixed(2);
}

export function curveBarWidth(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return "0%";
  return `max(${Math.min(100, p)}%, 3px)`;
}
