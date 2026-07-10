# StockDotFun — Curve Simulation Report

**Generated:** 2026-07-10 · **Script:** `scripts/simulate-curve.mjs` ·
**Data:** `curve-sim-results.json` / `.csv`

## Method

The simulator reimplements the exact pool math from `BondingCurvePool.sol` —
constant product `k = (Vq + realQuote)·(Vt + tokenReserve)` with virtual
reserves, rounding in the pool's favour, a 1% fee, and the 40/30/30 split — in
human units. It sweeps 48 candidate `(virtualQuote, virtualToken, graduationTarget)`
combinations and scores each against launch-quality criteria.

## Scenarios modelled

For each candidate the simulator computes:

1. **Tiny launch** — 0.05 ETH buys → starting price, early slippage.
2. **Normal launch** — repeated ~0.02–0.03 ETH buys walked to graduation.
3. **Viral launch** — supply-sold %, price multiple, FDV at graduation.
4. **Whale-dominated** — 5 ETH single-buy slippage (167% at recommended params — whales are heavily penalised, which protects small buyers).
5. **Heavy selling** — round-trip cost (buy then immediately dump).
6. **High churn** — round-trip cost proxies repeated in/out bleed (1.99%).
7. **Low volume / dead token** — holder rewards accrued by graduation (tiny, honest — rewards track real volume, never guaranteed).
8. **High volume / reward-heavy** — holder reward accrual scales linearly with fee volume.
9. **Reward-asset illiquidity** — handled by the router layer (Phase 6): if the stock-token swap is unavailable, holder fees accrue in WETH.
10. **Router failure** — covered by `test/Hardening.t.sol` (Noop/reverting/lying routers fail safe or fail closed).

## Scoring criteria

A candidate scores points for: 55–88% supply sold at graduation; 3–15× price
multiple; <3% slippage on a 0.5 ETH buy; <4% round-trip cost; graduation in the
3–6 ETH band.

## Result — recommended parameters

`virtualQuote = 3 ETH`, `virtualToken = 73,000,000`, `graduationTarget = 4.4 ETH`
(top-scored candidate, score 8/10). Full metrics in
[default-parameters.md](default-parameters.md).

The recommendation deliberately accepts high large-buy slippage (17.7% at
0.5 ETH) in exchange for strong early-buyer upside and a clean ~2% round-trip
cost. This is the fair-launch meme profile. The alternative deep-curve profile
(higher `virtualQuote`) is a one-line change; see the "known tradeoff" section
of default-parameters.md.

## MEV / sandwich sensitivity

Because the curve is shallow, it is **sandwich-sensitive** on large buys — a
searcher can front-run a big buy and back-run it. Mitigations in place:

- **Mandatory non-zero `minOut`** on every buy/sell (contract-enforced) — a
  user's slippage tolerance bounds their loss.
- Frontend sets a **default max-slippage** and derives `minOut` from a live
  quote, so blind trades are impossible.
- Robinhood Chain is an Arbitrum L2 with a **sequencer** (FCFS ordering, no
  public mempool auction) — this materially reduces classic mempool sandwich
  attacks compared to L1, though it does not eliminate sequencer-level risk.

This remains a **known risk** (see `docs/security/known-risks.md`), not a solved
problem. Users trading large size should split orders.
