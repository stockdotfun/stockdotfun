# StockDotFun — Fee Split Policy

## Per-trade fee

Every buy and sell through a `BondingCurvePool` charges a fee on the **quote
(ETH/WETH) side** of the trade. Wallet-to-wallet token transfers are **never**
taxed — there is no reflection / hidden transfer tax.

| Component | Default | Where it goes |
| --- | --- | --- |
| **Total fee** | **1.00%** (100 bps) | split below |
| → Holder reward vault | 40% of the fee | Accumulates the paired stock token (via router) for eligible holders; falls back to WETH if routing is unavailable |
| → Creator rewards | 30% of the fee | Creator's `CreatorRewardVault` balance, in their chosen route (ETH / stock / 50-50) |
| → Protocol treasury | 30% of the fee | `treasury` address (set by owner, event-logged) |

## Invariants (enforced on-chain)

- `totalFeeBps ≤ 1000` — a **10% hard cap**. `setFeeConfig` reverts above it.
- `holderShareBps + creatorShareBps + protocolShareBps == 10000` — shares must
  sum to exactly 100% of the fee; any other config reverts (`SharesInvalid`).
- Fee is taken **before** tokens/quote are paid out, and reward routing uses
  checks-effects-interactions with `ReentrancyGuard`.
- The holder vault and creator vault have **no admin withdrawal path** — the
  owner cannot drain accrued rewards (see `docs/security/admin-powers.md`).

## Reward routing policy

- Holder fees are converted to the **paired tokenized stock asset** only through
  an explicitly-configured, verified `RouterAdapter`.
- If no router is configured (`address(0)` or `NoopRouterAdapter`), holder fees
  **accrue safely in WETH** — user funds are never sent into an unknown router.
- A router that consumes quote but delivers nothing causes the **whole trade to
  revert** (`RouterMisbehaved`) — reward accounting can never be corrupted and
  the reserve can never be silently drained.

## Rewards are never guaranteed

Holder and creator rewards are funded **only** by real trading activity. They
scale with volume, can be zero for a low-volume token, and are subject to
protocol configuration and asset availability. This platform issues no
dividends and confers no stock ownership.
