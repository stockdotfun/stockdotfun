# StockDotFun V2 — Completion Report

_Robinhood Chain (chain 4663). All on-chain claims below are backed by a passing
mainnet-fork test, a verification script, or an on-chain read — not by assertion.
Nothing here is independently audited, and no V2 contract has been broadcast to
mainnet yet._

## 1. Existing V1 deployment status
V1 is **live and immutable** on Robinhood Chain (no proxy, no admin upgrade path).

| Contract | Address |
|---|---|
| Factory (V1) | `0x7029f7289dcb3ea60c52ec89ea77089d420233d5` |
| StockAssetRegistry (V1) | `0xe3f9dd5d4cd703d9f33fdf27d9d8f10e5f24349a` |
| CreatorRewardVault (V1) | `0x871373548174Bdfa294Ba946C7A4F4Eef1ef0264` |
| NoopRouterAdapter (V1) | `0x237d69213ba9e63f1cc3eb4936c9dc2bdc7407d7` |
| Owner / Treasury | `0xCBC88Ba9…` (hot EOA) / `0x988a17…` |

V1 pays rewards in **WETH** (its router was the Noop adapter). It keeps working; V2 is additive.

## 2. Upgradeability assessment
V1 contracts are **not upgradeable** (checked: no `Initializable`/UUPS/proxy/delegatecall). Therefore V2 is a **fresh deployment**; V1 is marked **deprecated** in the `VersionRegistry`, not patched. No V1 user funds are moved.

## 3. V2 architecture
- **Async, batched stock conversion** (not per-trade): pool fees accrue as WETH in `StockRewardTreasury`; a narrowly-scoped keeper calls `convertPending` to swap WETH→USDG→stock in bounded batches and distribute the stock to holder/creator vaults. Failure retains WETH (state `FAILED`), never fabricates rewards.
- **Real graduation**: `BondingCurvePoolV2` lifecycle `ACTIVE → READY_TO_GRADUATE → MIGRATING → GRADUATED / MIGRATION_FAILED`; the crossing buy caps at the target and refunds excess; principal migrates to a **permanently locked** Uniswap V4 position.
- **Whitelist-gated routing**: `StockRouteRegistry` (statuses `DISABLED/DISCOVERED/VERIFIED/LOW_LIQUIDITY/PAUSED`) is the only source of routes; the adapter cannot be pointed at arbitrary tokens/pools/calldata.

## 4. Verified Uniswap addresses (Part 1 — 17/17 on-chain checks)
| Contract | Address |
|---|---|
| PoolManager | `0x8366a39cc670b4001a1121b8f6a443a643e40951` |
| PositionManager | `0x58daec3116aae6d93017baaea7749052e8a04fa7` |
| V4Quoter | `0x8dc178efb8111bb0973dd9d722ebeff267c98f94` |
| StateView | `0xf3334192d15450cdd385c8b70e03f9a6bd9e673b` |
| UniversalRouter | `0x8876789976decbfcbbbe364623c63652db8c0904` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

Verify: `npx tsx scripts/verify-uniswap-robinhood.ts` → `docs/integrations/uniswap-robinhood-verification.md`.

## 5. Verified stock routes (Part 2)
**VERIFIED (8, eligible for launch):** AAPL, GOOGL, META, MU, NVDA, SPCX, TSLA (clean to ~0.5 WETH), SPY (to ~0.1 WETH).
**Rejected LOW_LIQUIDITY (17):** AMD, AMZN, BABA, BE, COIN, CRCL, CRWV, INTC, MSFT, ORCL, PLTR, SNDK, USAR, QQQ, SGOV, SLV, USO.
Routing hub is **USDG**; base hop is **ETH/USDG** (fee 460). Data: `config/verified-stock-routes.json`, `docs/integrations/stock-liquidity-report.md`. Regenerate: `node scripts/discover-stock-liquidity.mjs`.

## 6. Liquidity & price-impact report
Real `V4Quoter` output at graduated block, e.g. TSLA 0.1 WETH → 0.4402 TSLA @ 0.07% impact; AAPL 0.5 WETH → 2.838 AAPL @ 0.13%. Several rejected assets (AMZN, USO) only have 90%-fee junk pools. Even verified assets are thin (~$900/swap < 3% impact) — the reason conversion is async + size-bounded.

## 7. Stock conversion test results (Part 3)
`test/fork/StockConversionFork.t.sol` (mainnet fork) — PASS:
- `testFullConversionFlow`: WETH fee → `convertPending` → **0.264 TSLA to holder vault, 0.132 TSLA to creator** → both claimed.
- `testNoSilentFallbackOnFailure`: bad slippage → WETH retained, zero fake stock, state `FAILED`, retry succeeds.
- `testProtocolWethForwarded`: protocol WETH forwarded.

## 8. Graduation test results (Part 4)
`test/fork/GraduationFork.t.sol` + `GraduationLifecycleFork.t.sol` + `FactoryV2Fork.t.sol` — PASS:
- Real Uniswap V4 MEME/WETH pool created; on-chain `getLiquidity` == minted.
- Graduated pool tradable (0.05 WETH → 4,716 MEME); crossing buy refunds excess; curve halts; post-graduation curve trades revert; excess burned.

## 9. Liquidity lock proof
`V4LiquidityLocker` owns the position **directly in the PoolManager**; it has **no function that removes liquidity** (compile-time guarantee) → principal provably unrecoverable (stronger than a transferable NFT). Fees are collectible only to an **immutable** recipient. Proven: liquidity unchanged after trading; fees collected.

## 10. Indexer deployment status
**Not yet built.** Design chosen: Ponder + Postgres indexing the V2 events. **Blocked on operator**: Postgres + hosting to run it "live." Until then the frontend shows empty lists on mainnet (same as V1 today).

## 11. Metadata storage status
**Not yet built.** Design: Pinata/IPFS provider with validation + JSON pinning, enforced non-empty `metadataURI` (already enforced on-chain in `FactoryV2`). **Blocked on operator**: Pinata API key.

## 12. Frontend integration status
**Not yet rewired.** Depends on the indexer (#10). Contract-level states needed by the UI (lifecycle, `RewardConversionState`, pending vs converted) exist and are readable.

## 13. Mainnet deployment addresses (V2)
**None yet** — no V2 contract has been broadcast. `deployments/robinhood-mainnet-v2.json` is a template to fill after `DeployRobinhoodV2`.

## 14. Transaction hashes
**None** — no V2 mainnet transactions. All proofs are mainnet-**fork** tests.

## 15. Ownership status
V2 deploy leaves the deployer as owner so routes can be seeded, then ownership of all 7 Ownable2Step contracts is handed to a multisig (two-step). See runbook (#19).

## 16. Remaining risks
- **Unaudited** V4-integrated contracts custody real funds.
- Owner is whatever key deploys — must become a **multisig**.
- Stock liquidity is **thin**; conversions must stay size-bounded (enforced per route).
- Keeper liveness: unconverted rewards sit as WETH until a keeper runs (safe, but delayed).
- Graduation price uses the terminal curve ratio; extreme states could leave dust (handled/burned).

## 17. External audit status
**Outstanding.** Required before any V2 mainnet launch.

## 18. Exact environment variables (V2 deploy)
```
RHC_RPC_URL=https://rpc.mainnet.chain.robinhood.com
DEPLOYER_PRIVATE_KEY=0x…            # fresh, funded, never pasted anywhere
PROTOCOL_TREASURY=0x…               # protocol fee recipient + LP-fee recipient
NEW_OWNER=0x…                       # multisig to own the protocol
KEEPER=0x…                          # address allowed to call convertPending
DEPLOY_CHECKLIST_ACK=I_HAVE_READ_DEPLOYMENT_CHECKLIST_AND_ACCEPT_MAINNET_RISK
ROUTE_REGISTRY=0x…                  # set after deploy, for SeedStockRoutes
```
Frontend (after deploy, from script output): `NEXT_PUBLIC_V2_FACTORY_ADDRESS`, `…_STOCK_ROUTE_REGISTRY`, `…_STOCK_REWARD_TREASURY`, `…_CREATOR_VAULT`, `…_GRADUATION_MANAGER`, `…_GRADUATION_ADAPTER`, `…_LIQUIDITY_LOCKER`, `…_STOCK_CONVERSION_ADAPTER`, `NEXT_PUBLIC_VERSION_REGISTRY`.

## 19. Operate the keeper / deploy runbook
```bash
# preflight
cast chain-id --rpc-url $RHC_RPC_URL         # 4663
forge test                                   # 49/49
forge script script/DeployRobinhoodV2.s.sol --rpc-url $RHC_RPC_URL -vvv   # dry run
# broadcast
forge script script/DeployRobinhoodV2.s.sol --rpc-url $RHC_RPC_URL --broadcast -vvv
# seed only verified routes (deployer still owns registry)
export ROUTE_REGISTRY=0x<printed>
forge script script/SeedStockRoutes.s.sol --rpc-url $RHC_RPC_URL --broadcast -vvv
# hand ownership to the multisig (per contract), then multisig acceptOwnership()
# keeper: convert a pool's pending stock rewards
cast send $TREASURY "convertPending(address,uint256,uint256,uint256)" \
  $POOL <maxWeth> <minStockOut> $(($(date +%s)+600)) --rpc-url $RHC_RPC_URL --account keeper
```

## 20. Safe-pause commands
```bash
cast send $FACTORY  "setTradingPaused(bool)" true  --rpc-url $RHC_RPC_URL --account owner  # halt curve trading
cast send $FACTORY  "setClaimsPaused(bool)"  true  --rpc-url $RHC_RPC_URL --account owner  # halt claims
cast send $FACTORY  "setCreationPaused(bool)" true --rpc-url $RHC_RPC_URL --account owner  # halt new launches
cast send $TREASURY "setState(address,uint8)" $POOL 2 --rpc-url $RHC_RPC_URL --account owner  # 2=PAUSED conversion
```

---

## Final answers (no overclaiming)
- **Truly functional (fork-proven):** async stock conversion → real stock in vaults + claims; real V4 graduation with permanently-locked, tradable liquidity; the full factory-assembled create→trade→graduate path. 49/49 tests incl. 11 mainnet-fork.
- **Were actual stock tokens acquired?** **Yes, on a mainnet fork** (real TSLA/AAPL delivered). **Not yet on mainnet** — no V2 broadcast.
- **Stocks enabled:** the 8 VERIFIED. **Rejected for low liquidity:** the 17 listed.
- **Graduation creates a real Uniswap pool?** **Yes** (fork-proven), MEME/WETH, liquidity locked.
- **Where is liquidity locked?** In `V4LiquidityLocker`, held directly in the PoolManager with no removal path.
- **Curve trading stops after graduation?** **Yes** (fork-proven).
- **Indexer live?** **No** — built design only; needs Postgres+hosting.
- **Metadata permanent?** **Not yet** — needs a Pinata key; on-chain non-empty URI is enforced.
- **Contracts deployed?** V2: **none on mainnet yet**; all deployable via `DeployRobinhoodV2`.
- **Blocked tasks:** indexer live-hosting, IPFS key, frontend end-to-end, V2 mainnet broadcast (funded signer), independent audit.
- **Independent audit outstanding?** **Yes.**
