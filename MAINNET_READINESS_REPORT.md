# StockDotFun — Mainnet Readiness Report

**Date:** 2026-07-10 · **Chain:** Robinhood Chain mainnet (4663), an Arbitrum L2
with native ETH gas.

> **Bottom line:** contracts compile, 32 tests pass (unit + hardening + fuzz),
> all 27 Robinhood token addresses are verified, config is mainnet-real, and the
> deploy pipeline dry-runs cleanly against the live RPC. **Mainnet deployment is
> BLOCKED** on one hard requirement — an external audit — plus a live testnet
> exercise and multisig ownership. No independent audit has been performed.

## 1. Verified network details (live-checked)
| Item | Value | Status |
| --- | --- | --- |
| Mainnet chain ID | 4663 | ✅ `cast chain-id` |
| Testnet chain ID | 46630 | ✅ `cast chain-id` |
| Mainnet RPC | https://rpc.mainnet.chain.robinhood.com | ✅ live (block 6.1M) |
| Explorer | https://robinhoodchain.blockscout.com | ✅ API v2 live |
| Native currency | ETH | ✅ per docs |

## 2. Verified base assets
| Symbol | Address | decimals | Status |
| --- | --- | --- | --- |
| WETH | 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73 | 18 | ✅ 53,569 holders |
| USDG | 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168 | 6 | ✅ 8,770 holders |

## 3. Verified stock tokens (20/20)
All verified against docs + on-chain reads + Blockscout: AAPL, AMD, AMZN, BABA,
BE, COIN, CRCL, CRWV, GOOGL, INTC, META, MSFT, MU, NVDA, ORCL, PLTR, SNDK, SPCX,
TSLA, USAR — all 18 decimals. Full table + addresses in
`docs/mainnet-verification/token-address-verification.md`.

## 4. Verified ETF tokens (5/5)
QQQ, SGOV, SLV, SPY, and CUSO (on-chain symbol `USO`) — all 18 decimals, all
verified. **Note:** docs list "CUSO"; on-chain `symbol()` is `USO` — registry
records both.

## 5. Contract deployment readiness
- ✅ `DeployRobinhood.s.sol` — chain-gated (4663/46630 only), env-validated,
  dry-run by default, broadcast only with `DEPLOY_CHECKLIST_ACK` + `--broadcast`.
- ✅ Seeds 25 assets (standard enabled, thin/private disabled).
- ✅ Launches with `NoopRouterAdapter` (holder fees accrue in WETH safely).
- ✅ Post-deploy read-back assertions.
- ✅ **Dry-run verified against live mainnet RPC** — correct plan, stops at gate.
- ⛔ Not executed (blocked — see §13).

## 6. Frontend readiness
- ✅ Chain config defaults to verified mainnet; Alchemy RPC preferred if set.
- ✅ Canonical registry drives the create-flow selector, docs, admin.
- ✅ `PlatformStatus` strip: mainnet/contracts/registry/routing/demo state (honest).
- ✅ Trading/claims disabled with clear reasons until contracts configured.
- ✅ "Reward routing not configured yet" shown until a verified router is set.
- ✅ **Demo mode hard-blocked on chain 4663** (even if the flag is true).
- ✅ `check:config` prebuild guard fails the build on mock/dev addresses.
- ✅ `next build` + `eslint` + `tsc` clean.

## 7. Test coverage summary
- **32/32 tests passing.** Unit 15 · Hardening 13 · Invariant 4.
- Coverage %: not captured (via-IR needs `--ir-minimum`) — remaining item.

## 8. Fuzz / invariant summary
- 4 invariants, 256 runs × ~500 calls each (~128k calls), **0 violations, 0 reverts** in driver:
  vault solvency, pool reserve backing, eligible-supply bound, curve depth.

## 9. Static analysis summary
- `forge fmt` ✅ · `forge build` ✅ (only benign erc20-unchecked-transfer lints on
  our own OZ token transfers).
- `slither` / `mythril`: **not installed in this environment** — remaining pre-audit step.

## 10. Curve economics recommendation
`virtualQuote=3 ETH`, `virtualToken=73M`, `graduationTarget=4.4 ETH` (derived by
`scripts/simulate-curve.mjs`, top-scored of 48 candidates): 64% supply sold at
graduation, 6.1× multiple, 1.99% round-trip. Large-buy slippage intentionally
high (fair-launch profile). Details: `docs/economics/`.

## 11. Fee split recommendation
1% per trade, split 40% holders / 30% creator / 30% protocol. Hard-capped at 10%,
shares must sum to 100%. `docs/economics/fee-split-policy.md`.

## 12. Known risks
See `docs/security/known-risks.md`. Headline: no audit; owner centralization
(EOA); shallow-curve MEV; upgradeable issuer-controlled stock tokens; routing +
graduation not yet live; metadata storage not connected.

## 13. Remaining blockers before mainnet
1. ⛔ **External independent audit** (hard blocker).
2. ⛔ Live **testnet** deploy + full flow exercise (create/buy/sell/claim).
3. ⛔ **Multisig + timelock** ownership (not an EOA).
4. ⚠️ `slither`/`mythril` run + triage.
5. ⚠️ `forge coverage` ≥ 90%.
6. ⚠️ Graduation/migration implemented or explicitly disclosed to auditors.
7. ⚠️ Metadata storage backend connected (IPFS/Arweave/S3/R2).
8. ⚠️ Verified `RouterAdapter` (or ship with routing off, as configured).

## 14. External audit requirement
**Required.** This report and `docs/security/*` constitute an internal review
only. Do not handle meaningful value before an external audit.

## 15. Exact commands to deploy (after blockers cleared)
```bash
cd contracts
# dry run
export RHC_RPC_URL=https://rpc.mainnet.chain.robinhood.com
export DEPLOYER_PRIVATE_KEY=0x...   # secure key, never committed
export PROTOCOL_TREASURY=0x...      # multisig
export NEW_OWNER=0x...              # governance multisig (optional)
forge script script/DeployRobinhood.s.sol --rpc-url $RHC_RPC_URL
# broadcast (only after dry run + checklist)
export DEPLOY_CHECKLIST_ACK=I_HAVE_READ_DEPLOYMENT_CHECKLIST
forge script script/DeployRobinhood.s.sol --rpc-url $RHC_RPC_URL --broadcast
```
Then copy printed `NEXT_PUBLIC_*` addresses into the frontend env and
`acceptOwnership()` from the multisig.

## 16. Exact env vars required
Frontend (`.env.example`): `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_RHC_RPC_URL`,
`NEXT_PUBLIC_ALCHEMY_RHC_RPC_URL`, `NEXT_PUBLIC_RHC_EXPLORER_URL`,
`NEXT_PUBLIC_WETH_ADDRESS`, `NEXT_PUBLIC_USDG_ADDRESS`,
`NEXT_PUBLIC_FACTORY_ADDRESS`, `NEXT_PUBLIC_ROUTER_ADDRESS`,
`NEXT_PUBLIC_STOCK_ASSET_REGISTRY_ADDRESS`, `NEXT_PUBLIC_REWARD_VAULT_ADDRESS`,
`NEXT_PUBLIC_CREATOR_REWARD_VAULT_ADDRESS`, `NEXT_PUBLIC_PROTOCOL_TREASURY`,
`NEXT_PUBLIC_DEMO_MODE=false`, `ADMIN_ENABLED`.
Deploy (Foundry, never client-exposed): `DEPLOYER_PRIVATE_KEY`, `RHC_RPC_URL`,
`PROTOCOL_TREASURY`, `NEW_OWNER`, `DEPLOY_CHECKLIST_ACK`.

## 17. Exact files changed / added (this phase)
**Verification:** `docs/mainnet-verification/{token-address-verification.md,raw-results.txt,blockscout-results.txt}`
**Config:** `lib/config.ts`, `lib/chains/robinhood.ts`, `lib/data/assets.ts`, `.env.example`, `.env.local`
**Registry:** `lib/assets/robinhoodAssets.ts`, `lib/assets/validateAssetRegistry.ts`, `types/token.ts`, `scripts/check-config.mjs`, `package.json` (prebuild/check:config)
**Contracts (hardened):** `StockDotFunFactory.sol`, `BondingCurvePool.sol`, `RewardVault.sol`, `CreatorRewardVault.sol`, `StockAssetRegistry.sol`; new `NoopRouterAdapter.sol`, `interfaces/IPlatformControls.sol`
**Contracts (deploy/config):** `script/config/RobinhoodConfig.sol`, `script/DeployRobinhood.s.sol`, `script/LocalE2E.s.sol` (mainnet guard)
**Contracts (tests):** `test/Hardening.t.sol`, `test/Invariants.t.sol`, updated `test/StockDotFun.t.sol`
**Economics:** `scripts/simulate-curve.mjs`, `docs/economics/*`
**Security docs:** `docs/security/*`
**Frontend:** `components/platform/PlatformStatus.tsx`, `components/platform/RewardRoutePreview.tsx`, `app/(marketing)/docs/supported-assets/page.tsx`, `app/(app)/admin/page.tsx`, `app/(app)/launch/page.tsx`, `hooks/useLaunchConfig.ts`
**Reports:** `MAINNET_READINESS_REPORT.md`, `SECURITY_CHECKLIST.md`, `DEPLOYMENT_CHECKLIST.md`, `ECONOMICS_CHECKLIST.md`, `AUDIT_PACKAGE.md`
