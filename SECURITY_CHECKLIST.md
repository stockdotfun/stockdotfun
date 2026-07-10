# StockDotFun — Security Checklist

Status legend: ✅ done · ⚠️ partial · ⛔ blocker (must do before mainnet value)

## Access control
- ✅ Ownable2Step on Factory + Registry
- ✅ `onlyOwner` on all admin setters
- ✅ `OnlyPool` / `OnlyFactory` / `OnlyMemeToken` guards on internal wiring
- ⚠️ Owner is an EOA in scripts — ⛔ move to **multisig + timelock** for mainnet

## Fund safety
- ✅ No admin withdrawal from holder or creator reward vaults
- ✅ No pool reserve rescue path
- ✅ Fixed token supply, no arbitrary mint
- ✅ SafeERC20 everywhere; false-return tokens revert
- ✅ ReentrancyGuard on buy/sell/claim/notify

## Accounting correctness
- ✅ Curve rounds in the pool's favour (buy & sell)
- ✅ `ExceedsCurveDepth` prevents over-issuance
- ✅ acc-per-share reward model; per-holder checkpointing
- ✅ Invariant: vault balance ≥ Σ claimable (128k fuzz calls, 0 violations)
- ✅ Invariant: pool balance ≥ tracked reserve

## Router / external calls
- ✅ Balance-delta measurement (adapter return value never trusted)
- ✅ Fail-closed on misbehaving router (`RouterMisbehaved`)
- ✅ NoopRouterAdapter for explicit "routing off"
- ✅ No hardcoded/assumed DEX router

## Input validation
- ✅ Zero-address checks
- ✅ Fee cap (10%) + share-sum (100%) enforced
- ✅ Curve param bounds (`MAX_VIRTUAL_*`, non-zero)
- ✅ Mandatory non-zero `minOut` (no slippage-blind trades)
- ✅ Registry gates supported stock assets; disabled/unsupported rejected

## Operational
- ✅ Separate trading / claims pause switches
- ✅ Full events on every critical action
- ✅ Chain-gated, ack-gated deploy script with dry run
- ✅ Config guard (`check:config`) blocks mock addresses in prod build

## Not yet done (pre-mainnet)
- ⛔ **External independent audit**
- ⚠️ `slither` / `mythril` static analysis (tools not installed here)
- ⚠️ `forge coverage` report
- ⚠️ Live testnet exercise
- ⚠️ Multisig ownership + timelock
- ⚠️ Graduation/migration implementation (or explicit auditor disclosure)
