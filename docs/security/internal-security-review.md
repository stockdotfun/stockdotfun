# StockDotFun — Internal Security Review

**Status: Internal security review completed. External independent audit required
before handling meaningful value.** This is NOT an audit.

**Date:** 2026-07-10 · **Reviewer:** internal engineering · **Commit:** working tree

## Scope
`contracts/src/`: StockDotFunFactory, MemeToken, StockAssetRegistry,
BondingCurvePool, RewardVault, CreatorRewardVault, IRouterAdapter,
NoopRouterAdapter, IPlatformControls.

## Method
- Manual review against the security rules in the engineering brief (20 items).
- `forge build` (via-IR, optimizer), `forge fmt`.
- 32 automated tests: unit (`StockDotFun.t.sol`), hardening (`Hardening.t.sol`),
  fuzz/invariant (`Invariants.t.sol`, 256 runs × ~500 calls each).
- Static analysis (`slither`): **not run — tool not installed in this
  environment.** Listed as a remaining pre-audit step.

## Findings fixed during review
| Sev | Finding | Fix |
| --- | --- | --- |
| Critical | Buy could compute more tokens than the pool held (virtual-reserve overshoot) → `InsufficientBalance` / potential drain | `ExceedsCurveDepth` guard + round tokensOut down |
| Critical | Full sell underflowed `realQuote` (rounding) | round grossOut down (favour pool) |
| High | Router could consume quote and deliver nothing, corrupting reward accounting / draining reserve | balance-delta measurement + fail-closed `RouterMisbehaved` |
| Medium | Slippage-blind trades (`minOut = 0`) allowed | mandatory non-zero `minOut` |
| Medium | Single-step ownership (fat-finger to wrong address) | Ownable2Step on factory + registry |
| Medium | No emergency controls | separate `tradingPaused` / `claimsPaused` |
| Medium | Curve params unbounded (zero price / overflow) | `InvalidCurveParams` + `MAX_VIRTUAL_*` |
| Low | Sparse events on admin actions | full event set on all setters |

## Security rules checklist (from brief)
1. No external calls before state updates — ✅ CEI + guards
2. Checks-effects-interactions — ✅
3. ReentrancyGuard on buy/sell/claim/notify — ✅
4. SafeERC20 — ✅
5. Admin cannot drain holder vault — ✅ (no withdraw path)
6. No over-claim — ✅ (acc-per-share, invariant `VaultSolvent`)
7. No fee bypass — ✅
8. No unsupported reward asset — ✅ (registry gate; vault reward-asset set)
9. No zero-address assets — ✅
10. Fee caps enforced — ✅ (`MAX_FEE_BPS`)
11. No double pool init — ✅ (`PoolAlreadySet`)
12. No invalid curve params — ✅
13. Slippage-insensitive trades blocked — ✅ (mandatory minOut)
14. Price cannot be zero/overflow — ✅ (non-zero virtuals + `MAX_VIRTUAL_*`)
15. No silently-swallowed transfers — ✅ (SafeERC20)
16. Complete events — ✅
17. Separate pause for trading & claims — ✅
18. Tightly-controlled treasury — ✅ (owner-only, event-logged; per-pool at creation)
19. Two-step ownership — ✅ (Ownable2Step)
20. Admin powers documented — ✅ (`admin-powers.md`)

## Test summary
- **32/32 passing.** Unit 15, hardening 13, invariant 4.
- Invariants held over ~128k randomized calls each: vault solvency, pool reserve
  backing, eligible-supply bound, curve-depth respect. 0 reverts in fuzz driver.

## Remaining pre-audit steps
- Run `slither` and `mythril` (not installed here); triage output.
- Add `forge coverage` report (via-IR coverage needs `--ir-minimum`).
- Deploy to Robinhood **testnet** and exercise the full flow live.
- Implement graduation/migration or explicitly document its absence to auditors.
- Independent external audit.
