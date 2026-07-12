# StockDotFun V2 — Threat Model & Internal Review

_Internal engineering review. **Not** an independent audit — one is still
required before mainnet._

## Assets at risk
- Curve principal WETH (in `BondingCurvePoolV2` until graduation).
- Pending reward WETH (in `StockRewardTreasury`).
- Converted stock tokens (in `RewardVaultV2` / `CreatorRewardVaultV2`).
- Locked LP position (in `V4LiquidityLocker`).

## Trust boundaries & mitigations
| Actor | Can do | Cannot do | Mitigation |
|---|---|---|---|
| Keeper | trigger `convertPending` | pick token/recipient/route/calldata; set slippage to 0 (adapter requires nonzero `minStockOut`) | route fixed per pool; recipient = treasury; size capped by route; `onlyKeeper` |
| Owner (multisig) | pause trading/claims/creation/conversion; set routes; set keeper | withdraw holder/creator rewards; remove locked liquidity; change LP-fee recipient | no withdrawal fns; locker recipient immutable; Ownable2Step |
| Anyone | `finalize` graduation, `collectFees`, `withdrawProtocol` | change destinations (all fixed) | deterministic params; fixed recipients |
| Malicious ERC20 stock | — | be enabled | only owner-seeded VERIFIED routes usable |

## Key threats considered
- **Sandwich on conversion** → async + `minStockOut` + per-route size cap + keeper-gated; thin-liquidity assets excluded.
- **Lying / partial / zero-output router** → adapter measures delivered balance via V4 deltas and takes exact output; treasury `try/catch` keeps WETH on failure (`FAILED`), no fake credit.
- **Reentrancy** → `nonReentrant` on all external state-changing entry points; V4 unlock callbacks restricted to `msg.sender == poolManager`.
- **Arbitrary-recipient / arbitrary-calldata** → no caller-supplied call targets; routes and recipients are registry/immutable-defined.
- **Double graduation** → lifecycle guard (`READY_TO_GRADUATE`/`MIGRATION_FAILED` → `MIGRATING` → `GRADUATED`); no re-entry to ACTIVE.
- **Trade after threshold** → `_requireActive` reverts once not `ACTIVE` (fork + property tested).
- **Locked-liquidity withdrawal** → locker has no remove path (compile-time); principal provably unrecoverable.
- **Reserve insolvency / round-trip profit** → curve rounds in the pool's favor; `testFuzz_RoundTripNeverProfitable`, `testFuzz_PoolSolvent`.
- **Fixed supply / hidden mint** → `MemeTokenV2` mints once; no mint path; `test_SupplyFixedThroughTrading`.
- **Dust DoS at graduation** → excess burned; leftover WETH is dust and non-blocking.

## Residual risks (see completion report §16)
Unaudited; keeper liveness; thin stock liquidity; owner-key custody until multisig.

## Test coverage
49 tests: 11 mainnet-fork integration (conversion, graduation, factory, raw swap),
6 property/fuzz (round-trip, solvency, fee accounting, supply, threshold, refund),
plus the inherited V1 suite. Run: `forge test` (fork tests need `RHC_RPC_URL`).
