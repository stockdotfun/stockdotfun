/**
 * Bonding-curve economic simulation for StockDotFun.
 *
 * Models the exact pool math (constant product with virtual reserves) used by
 * BondingCurvePool.sol, in human units (tokens in whole units, ETH in whole
 * ETH) to keep values inside JS Number range. Sweeps candidate parameter sets
 * across launch scenarios and writes:
 *   - docs/economics/curve-sim-results.json
 *   - docs/economics/curve-sim-results.csv
 * The recommendation is chosen from these results (see curve-simulation-report.md).
 *
 * Run: node scripts/simulate-curve.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "economics");
mkdirSync(outDir, { recursive: true });

const SUPPLY = 1_000_000_000; // 1e9 meme tokens (matches MemeToken.TOTAL_SUPPLY)
const FEE_BPS = 100; // 1%
const ETH_USD = 1796; // reference price at verification (informational only)

/** A live pool state in human units. */
function makePool({ Vq, Vt }) {
  return { Vq, Vt, rQ: 0, reserve: SUPPLY };
}
function price(p) {
  return (p.Vq + p.rQ) / (p.Vt + p.reserve); // ETH per token
}
function quoteBuy(p, ethIn) {
  const fee = (ethIn * FEE_BPS) / 10000;
  const net = ethIn - fee;
  const q = p.Vq + p.rQ;
  const t = p.Vt + p.reserve;
  const k = q * t;
  const tokensOut = t - k / (q + net);
  return { tokensOut, fee, net };
}
function applyBuy(p, ethIn) {
  const { tokensOut, fee, net } = quoteBuy(p, ethIn);
  if (tokensOut > p.reserve) return null; // exceeds curve depth
  p.rQ += net;
  p.reserve -= tokensOut;
  return { tokensOut, fee };
}
function quoteSell(p, tokensIn) {
  const q = p.Vq + p.rQ;
  const t = p.Vt + p.reserve;
  const k = q * t;
  const grossOut = q - k / (t + tokensIn);
  const fee = (grossOut * FEE_BPS) / 10000;
  return { ethOut: grossOut - fee, fee, grossOut };
}
function applySell(p, tokensIn) {
  const { ethOut, fee, grossOut } = quoteSell(p, tokensIn);
  p.rQ -= grossOut;
  p.reserve += tokensIn;
  return { ethOut, fee };
}

/** Metrics for one (Vq, Vt, grad) candidate. */
function evaluate({ Vq, Vt, grad }) {
  const p0 = makePool({ Vq, Vt });
  const startPrice = price(p0);

  // slippage: single buy vs marginal price, at several sizes
  const slip = {};
  for (const size of [0.05, 0.5, 5]) {
    const pp = makePool({ Vq, Vt });
    const { tokensOut } = quoteBuy(pp, size);
    const avgPrice = size / tokensOut;
    slip[size] = (avgPrice / startPrice - 1) * 100; // % above spot
  }

  // round-trip: buy 1 ETH then immediately sell all received
  const rt = makePool({ Vq, Vt });
  const b = applyBuy(rt, 1);
  const s = applySell(rt, b.tokensOut);
  const roundTripCostPct = (1 - s.ethOut) * 100;

  // walk buys until graduation, measure supply sold + reward accrual
  const p = makePool({ Vq, Vt });
  let holderRewards = 0;
  let steps = 0;
  const buySize = Math.max(0.02, grad / 200); // ~200 buys to graduation
  while (p.rQ < grad && steps < 100000) {
    const res = applyBuy(p, buySize);
    if (!res) break;
    holderRewards += res.fee * 0.4; // 40% holder share
    steps++;
  }
  const soldPct = ((SUPPLY - p.reserve) / SUPPLY) * 100;
  const gradPrice = price(p);
  const priceMultiple = gradPrice / startPrice;
  const fdvAtGradUsd = gradPrice * SUPPLY * ETH_USD;

  return {
    Vq,
    Vt,
    grad,
    startPriceEthPerB: startPrice * 1e9, // ETH per 1B (i.e., per whole supply)
    startFdvUsd: startPrice * SUPPLY * ETH_USD,
    slip005: slip[0.05],
    slip05: slip[0.5],
    slip5: slip[5],
    roundTripCostPct,
    ethToGraduate: grad,
    soldPctAtGrad: soldPct,
    priceMultiple,
    fdvAtGradUsd,
    holderRewardsEthAtGrad: holderRewards,
  };
}

// ---- Candidate sweep ----
const candidates = [];
for (const Vq of [1, 1.5, 2, 3]) {
  for (const Vt of [SUPPLY * 0.05, SUPPLY * 0.073, SUPPLY * 0.1, SUPPLY * 0.2]) {
    for (const grad of [3, 4.4, 6]) {
      candidates.push(evaluate({ Vq, Vt, grad }));
    }
  }
}

// score: prefer 60-85% supply sold at graduation, price multiple 4-12x,
// <2% slippage on 0.5 ETH, round-trip cost near 2*fee (~2%).
function score(c) {
  let s = 0;
  s += c.soldPctAtGrad >= 55 && c.soldPctAtGrad <= 88 ? 3 : 0;
  s += c.priceMultiple >= 3 && c.priceMultiple <= 15 ? 3 : 0;
  s += c.slip05 < 3 ? 2 : 0;
  s += c.roundTripCostPct < 4 ? 1 : 0;
  s += c.grad >= 3 && c.grad <= 6 ? 1 : 0;
  return s;
}
candidates.forEach((c) => (c.score = score(c)));
candidates.sort((a, b) => b.score - a.score || a.slip05 - b.slip05);

writeFileSync(join(outDir, "curve-sim-results.json"), JSON.stringify(candidates, null, 2));
const cols = Object.keys(candidates[0]);
const csv = [cols.join(",")]
  .concat(candidates.map((c) => cols.map((k) => (typeof c[k] === "number" ? c[k].toFixed(6) : c[k])).join(",")))
  .join("\n");
writeFileSync(join(outDir, "curve-sim-results.csv"), csv);

const best = candidates[0];
console.log("Top candidate:");
console.log(JSON.stringify(best, null, 2));
console.log("\nSolidity params (18-decimal wei):");
console.log(`  virtualQuote     = ${best.Vq}e18`);
console.log(`  virtualToken     = ${(best.Vt / 1e6).toFixed(0)}_000_000e18`);
console.log(`  graduationTarget = ${best.grad}e18`);
