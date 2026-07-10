# StockDotFun — Audit Package

A pointer document for an external auditor. **Not an audit.** Internal review
only (`docs/security/internal-security-review.md`).

## Contracts in scope (`contracts/src/`)
| File | Purpose | LOC-ish |
| --- | --- | --- |
| `StockDotFunFactory.sol` | Deploys token+pool+vaults; admin; pause; platform controls | ~200 |
| `MemeToken.sol` | Fixed-supply ERC20; reward checkpoint hook; no transfer tax | ~60 |
| `StockAssetRegistry.sol` | Owner-controlled supported-asset registry | ~70 |
| `BondingCurvePool.sol` | Constant-product curve; buy/sell; fee routing | ~300 |
| `RewardVault.sol` | Per-token holder rewards (acc-per-share) | ~150 |
| `CreatorRewardVault.sol` | Global creator rewards | ~70 |
| `NoopRouterAdapter.sol` | Explicit routing-off adapter | ~20 |
| `interfaces/IRouterAdapter.sol`, `IPlatformControls.sol` | Interfaces | ~30 |

## Build / test
```bash
cd contracts
forge build        # solc 0.8.26, via-IR, optimizer 200
forge test         # 32 tests: unit + hardening + fuzz/invariant
forge fmt --check
```

## Test files
- `test/StockDotFun.t.sol` — 15 unit tests (create/buy/sell/fees/claims/admin)
- `test/Hardening.t.sol` — 13 tests (pause, unauthorized, router failure modes,
  malicious ERC20, repeated/non-holder claim, slippage bound, curve bounds,
  two-step ownership)
- `test/Invariants.t.sol` — 4 invariants (vault solvency, reserve backing,
  eligible-supply bound, curve depth) over a randomized handler

## Key design notes for auditors
1. **Quote asset is WETH** (verified `0x0Bd7…AD73`, 18 decimals). ETH↔WETH
   wrap/unwrap happens in the **frontend**, not the contracts.
2. **Reward routing** to stock tokens goes through a pluggable `RouterAdapter`.
   Launch config uses `NoopRouterAdapter` (fees accrue in WETH). Balance-delta
   accounting + fail-closed on misbehaviour.
3. **No admin fund access** — vaults have no rescue/withdraw; owner cannot take
   reserves or rewards. See `docs/security/admin-powers.md`.
4. **Graduation is a signal only** — DEX migration is **not implemented**
   (design TODO). Pools keep trading on the curve post-graduation.
5. **Curve params** are documented and derived (`docs/economics/`), bounded
   on-chain (`MAX_VIRTUAL_*`, non-zero, fee cap, share-sum).

## Supporting docs
- `docs/security/{internal-security-review,threat-model,known-risks,admin-powers,audit-readiness-checklist}.md`
- `docs/economics/{curve-simulation-report,default-parameters,fee-split-policy}.md`
- `docs/mainnet-verification/token-address-verification.md`

## Known issues we already flag (please still verify)
- Owner is an EOA in scripts → must be multisig+timelock for mainnet.
- Shallow curve is sandwich-sensitive on large buys (mandatory `minOut` bounds loss).
- Robinhood stock tokens are upgradeable issuer-controlled proxies.
- No external audit yet; `slither`/`mythril` not run in the build environment.
