# StockDotFun — Default Curve & Fee Parameters

Derived from `scripts/simulate-curve.mjs` (run 2026-07-10). Raw output:
`curve-sim-results.json` / `.csv`. These are **config, not magic numbers** —
see `contracts/script/config/RobinhoodMainnet.sol` and `lib/data/fees.ts`.

## Recommended bonding-curve parameters (per launch)

| Param | Value (human) | Solidity (18-dec wei) | Meaning |
| --- | --- | --- | --- |
| `virtualQuote` | 3 ETH | `3e18` | Virtual quote reserve — curve depth |
| `virtualToken` | 73,000,000 tokens | `73_000_000e18` | Virtual token reserve |
| `graduationTarget` | 4.4 ETH | `4.4e18` | Real ETH raised to graduate |
| Total supply | 1,000,000,000 | `1_000_000_000e18` | Fixed (MemeToken) |

### Simulated behaviour at these params

| Metric | Value |
| --- | --- |
| Starting FDV | ≈ $5,021 (at ETH=$1,796) |
| FDV at graduation | ≈ $30,729 |
| Price multiple, launch → graduation | 6.12× |
| Supply sold at graduation | 63.9% (36% reserved for migration) |
| Round-trip cost (buy 1 ETH → sell all) | 1.99% (≈ 2× the 1% fee — no hidden bleed) |
| Slippage, 0.05 ETH buy | 2.7% |
| Slippage, 0.5 ETH buy | 17.7% |
| Slippage, 5 ETH buy | 167% |
| Holder rewards accrued by graduation | ≈ 0.0179 ETH |

## Fee configuration

| Param | Value | Cap |
| --- | --- | --- |
| Total fee per trade | 1.00% (`100` bps) | Hard cap 10% (`MAX_FEE_BPS`) |
| Holder stock-token vault | 40% of fee (`4000` bps) | — |
| Creator rewards | 30% of fee (`3000` bps) | — |
| Protocol treasury | 30% of fee (`3000` bps) | Shares must sum to 10000 |

## Hard bounds (enforced on-chain)

- `MAX_VIRTUAL_QUOTE = 1e30`, `MAX_VIRTUAL_TOKEN = 1e33` — prevents overflow and zero-priced curves (`InvalidCurveParams`).
- `virtualQuote`, `virtualToken` must be non-zero.
- `totalFeeBps ≤ 1000` (10%).
- Fee shares must sum to exactly 10000.
- Every buy/sell requires a non-zero `minOut` (no slippage-blind trades).

## Known tradeoff — large-buy slippage

At `virtualQuote = 3 ETH` the curve is intentionally shallow: this gives early
buyers meaningful upside (meme dynamics) but means a **0.5 ETH buy moves price
~18%** and larger buys much more. This is by design for a fair-launch meme
curve, **not** a bug. If a deeper, calmer curve is preferred, raising
`virtualQuote` to 8–12 ETH cuts large-buy slippage substantially at the cost of
a higher starting FDV and smaller early-buyer upside — re-run the simulator and
pick from `curve-sim-results.csv`. The frontend enforces a default max-slippage
setting so users are protected regardless.
