# StockDotFun — Admin Powers

Ownership uses **Ownable2Step** on both `StockDotFunFactory` and
`StockAssetRegistry` (two-step transfer: `transferOwnership` → `acceptOwnership`).
Recommended owner for mainnet: a **multisig**, not an EOA.

## What the owner CAN do

| Power | Contract | Function | Blast radius |
| --- | --- | --- | --- |
| Add / enable / disable supported assets | `StockAssetRegistry` | `addAsset`, `setEnabled`, `setPriceFeed` | Gates which stock tokens new launches may pair with. Does not affect existing pools. |
| Set protocol treasury | `StockDotFunFactory` | `setTreasury` | Where the protocol fee share is sent for **new** pools (pools read treasury at creation). |
| Set router adapter | `StockDotFunFactory` | `setRouterAdapter` | Which adapter **new** pools use for stock-token conversion. `address(0)`/Noop = accrue in WETH. |
| Set fee config | `StockDotFunFactory` | `setFeeConfig` | Fee % + split for **new** pools. Capped: total ≤ 10%, shares sum to 100%. |
| Set curve params | `StockDotFunFactory` | `setCurveParams` | Curve depth/graduation for **new** pools. Bounded by `MAX_VIRTUAL_*`, non-zero. |
| Pause trading | `StockDotFunFactory` | `setTradingPaused` | Emergency: halts all pool buys/sells **and** new launches. |
| Pause claims | `StockDotFunFactory` | `setClaimsPaused` | Emergency: halts holder + creator reward claims (independent of trading). |
| Transfer ownership | both | `transferOwnership`/`acceptOwnership` | Two-step; to multisig. |

## What the owner CANNOT do

- **Cannot withdraw from the holder `RewardVault`** — there is no admin/rescue
  withdrawal function. Rewards are only movable by their eligible holder via
  `claim`.
- **Cannot withdraw from the `CreatorRewardVault`** — same; only the creator can
  claim their own balance.
- **Cannot drain a pool's reserve** — the pool has no admin transfer path; quote
  leaves only via `sell` (to the seller) and fee routing.
- **Cannot mint meme tokens** — `MemeToken` has a fixed supply minted once at
  creation.
- **Cannot retroactively change an existing pool's** fee, curve, treasury, or
  router — pools capture these as immutables/at-creation values. Config changes
  apply to future launches only. (The one exception: `BondingCurvePool.setRouterAdapter`
  is factory-only and currently unused by the factory post-creation; documented as
  a known lever.)
- **Cannot bypass the fee cap, share-sum, or curve bounds** — all validated.
- **Cannot pause a specific user** — pauses are global, not targeted.

## Centralization risk

Until ownership is a multisig with a timelock, the owner key can pause the
platform and steer new-launch configuration. It **cannot** take user funds or
accrued rewards. This is documented as a known risk (`known-risks.md`) and is
the single most important thing to harden operationally before mainnet (move to
multisig + timelock).
