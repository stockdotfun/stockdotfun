# StockDotFun V1 → V2 Migration

## Why a new deployment (not an upgrade)
V1 contracts are **immutable** (no proxy/UUPS). They cannot be patched. V2 is a
**separate deployment**; V1 is marked **deprecated** in the `VersionRegistry` and
kept read/claim-only. **No V1 user funds are moved** — there is no forced
migration.

## What changes in V2
| Concern | V1 | V2 |
|---|---|---|
| Holder/creator rewards | WETH (Noop router) | **Real stock tokens**, converted async via Uniswap V4 |
| Conversion timing | n/a (never converted) | Batched, keeper-triggered, size-bounded — never per-trade |
| Graduation | no-op flag | Real **locked** Uniswap V4 pool at terminal price |
| Supported stocks | 25 seeded | **8 VERIFIED** (liquidity-gated) |
| Launch metadata | optional | **mandatory non-empty URI** |

## User-facing behavior
- **Existing V1 pools** keep trading and claiming on V1. The UI labels them **Legacy (V1)**.
- **New launches** happen only on V2 (`activeVersion = 2` in the `VersionRegistry`).
- **V1 holders**: continue to claim WETH rewards on V1 vaults. There is no automatic conversion of V1 positions to V2.

## Operator migration steps
1. Deploy V2 (`DeployRobinhoodV2`).
2. Seed **only** VERIFIED routes (`SeedStockRoutes`).
3. Hand V2 ownership to a multisig (two-step) and set a keeper.
4. Point the frontend at the V2 addresses + stand up the indexer.
5. In the UI: mark V1 legacy, route "Create" to V2, keep V1 pages read-only.

## Frontend version resolution
Read `VersionRegistry.getActive()` for the canonical V2 factory, and
`getDeployment(1)` for the legacy V1 record. Distinguish per pool:
**Legacy V1**, **V2 active** (bonding curve), **V2 graduated** (trade on Uniswap —
link to the graduated pool).
