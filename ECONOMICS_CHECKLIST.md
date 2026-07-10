# StockDotFun — Economics Checklist

Derived from `scripts/simulate-curve.mjs`. Full analysis in `docs/economics/`.

## Recommended parameters (in config, not magic numbers)
- ✅ `virtualQuote = 3 ETH` (`3e18`)
- ✅ `virtualToken = 73,000,000` (`73_000_000e18`)
- ✅ `graduationTarget = 4.4 ETH` (`4.4e18`)
- ✅ Total supply `1,000,000,000` (fixed in MemeToken)
- ✅ Source of truth: `contracts/script/config/RobinhoodConfig.sol` + `lib/data/fees.ts`

## Fee policy
- ✅ 1% total fee (100 bps), hard cap 10%
- ✅ Split 40% holders / 30% creator / 30% protocol (sums to 100%)
- ✅ No wallet-to-wallet transfer tax
- ✅ Rewards funded only by real volume; never guaranteed

## Simulated behaviour (at recommended params)
- ✅ 63.9% of supply sold at graduation (36% reserved for migration)
- ✅ 6.1× price multiple launch → graduation
- ✅ Round-trip cost 1.99% (≈ 2× fee, no hidden bleed)
- ✅ Start FDV ≈ $5k, graduation FDV ≈ $31k (ETH=$1,796 ref)
- ⚠️ Large-buy slippage high by design (17.7% at 0.5 ETH) — documented tradeoff

## Safety defaults
- ✅ Mandatory `minOut` on-chain
- ✅ Frontend default max-slippage → derives `minOut` from live quote
- ⚠️ Sandwich-sensitive on large buys (L2 sequencer mitigates; residual risk)

## Open economic items
- ⚠️ Graduation → DEX migration not implemented
- ⚠️ Reward routing disabled at launch (fees accrue in WETH until verified router)
- ⚠️ Re-tune curve if a deeper/calmer profile is desired (one-line change)
