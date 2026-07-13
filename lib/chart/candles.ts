import type { TokenTrade } from "@/types/token";

export type Candle = { time: number; open: number; high: number; low: number; close: number };
export type VolumeBar = { time: number; value: number; up: boolean };

export const CANDLE_INTERVALS = [
  { label: "1s", sec: 1 },
  { label: "1m", sec: 60 },
  { label: "5m", sec: 300 },
  { label: "15m", sec: 900 },
  { label: "1h", sec: 3600 },
] as const;

/**
 * Fixed total supply of every MemeTokenV2 (1e9). We express the curve price as a
 * market cap in ETH (price-per-token * supply) so the chart's y-axis reads in a
 * human range instead of nano-ETH per-token prices — the same metric pump.fun
 * shows.
 */
const TOTAL_SUPPLY = 1_000_000_000;

/**
 * Aggregate raw trades into OHLC market-cap candles (+ per-bucket volume) by a
 * time bucket (seconds). Candles connect — each opens at the previous close —
 * so it reads like a real exchange chart. Bucketing yields unique, ascending
 * timestamps as lightweight-charts requires. Returns empty arrays when there
 * are no priced trades yet.
 */
export function tradesToCandles(
  trades: TokenTrade[],
  bucketSec: number,
): { candles: Candle[]; volumes: VolumeBar[] } {
  const pts = trades
    .filter((t) => (t.quoteAmountEth ?? 0) > 0 && t.tokenAmount > 0)
    .map((t) => ({
      time: t.timestamp,
      mcap: (t.quoteAmountEth! / t.tokenAmount) * TOTAL_SUPPLY,
      vol: t.quoteAmountEth!,
    }))
    .sort((a, b) => a.time - b.time);
  if (pts.length === 0) return { candles: [], volumes: [] };

  const byBucket = new Map<number, { mcaps: number[]; vol: number }>();
  for (const p of pts) {
    const b = Math.floor(p.time / bucketSec) * bucketSec;
    const cur = byBucket.get(b) ?? { mcaps: [], vol: 0 };
    cur.mcaps.push(p.mcap);
    cur.vol += p.vol;
    byBucket.set(b, cur);
  }

  const candles: Candle[] = [];
  const volumes: VolumeBar[] = [];
  let prevClose: number | undefined;
  for (const b of [...byBucket.keys()].sort((a, z) => a - z)) {
    const { mcaps, vol } = byBucket.get(b)!;
    const open = prevClose ?? mcaps[0];
    const close = mcaps[mcaps.length - 1];
    const high = Math.max(open, ...mcaps);
    const low = Math.min(open, ...mcaps);
    candles.push({ time: b, open, high, low, close });
    volumes.push({ time: b, value: vol, up: close >= open });
    prevClose = close;
  }
  return { candles, volumes };
}
