# Flap × StockDotFun — Operations Runbook

Operator guide for the StockDotFun × Flap trading + reward integration on **Robinhood Chain (chain id 4663)**.

> **Status: not deployed.** The contracts are built, fork-tested, and unit-tested; nothing is deployed, funded, or live on mainnet. The integration ships **disabled** (`FLAP_INTEGRATION_ENABLED=false`) and every activation step below is a future action gated on its own verification. Do not read any procedure here as evidence that a step has been performed.
>
> Source-of-truth priority: **on-chain state > verified Flap contracts > official Flap docs**. Never take an address from a social post. Re-run `scripts/verify-flap-robinhood.ts` before trusting any Flap address.

---

## 1. Component map

| Component | What it is | Address / source |
|---|---|---|
| Flap Portal (proxy) | Third-party bonding-curve + graduation contract we read/route through | `0x26605f322f7fF986f381bB9A6e3f5DAb0bEaEb09` (impl `0xd9C998…36b1` v5.14.16, proxy admin `0x21f7f9B3…1FF5`) |
| Flap V2 router / factory | Uniswap V2-fork graduation target on RHC | router `0x89e5DB8B…9eba`, factory `0x8bcEaA40…937f`, WETH `0x0Bd7D308…AD73` |
| `FlapV2DexAdapter` | Our thin swap wrapper over the V2 router (`buyWithETH` / `sellForETH`) | built, **not deployed** |
| `FlapDexAdapterRegistry` | Approves adapters; lists graduated tokens; blocks addresses; per-token enable flag | built, **not deployed** |
| `StockDotFunExternalTradeGateway` | User entrypoint (`buy`/`sell`); emits `ExternalTradeExecuted` (`source=keccak256("FLAP")`); Pausable | built, **not deployed** |
| `ExternalTradeRewardVault` | Holds **real** tokenized-stock inventory; per-asset config; funded externally | built, **not deployed** |
| `CommitRevealRandomnessProvider` | Commit-reveal seed per epoch (no verified VRF on RHC) | built, **not deployed** |
| `RewardEpochManager` / `ExternalTradeRewardManager` | Epoch lifecycle, credit attribution, deterministic reward selection, claims | built, **not deployed** |

Deploy script: `contracts/script/DeployFlapIntegration.s.sol` (refuses to broadcast unless `block.chainid == 4663`). It deploys the trading + reward stack, approves the V2 adapter, wires vault/rng/gateway into the manager, and **intentionally leaves rewards OFF** — it never calls `gateway.setRewardConfig(...)`.

---

## 2. Environment variables

### Backend / indexer (`.env.local`)

| Var | Default (`.env.example`) | Meaning |
|---|---|---|
| `FLAP_INTEGRATION_ENABLED` | `false` | Master kill switch. Keep `false` until every phase below is verified. |
| `FLAP_ROBINHOOD_PORTAL_ADDRESS` | `0x26605f…Eb09` | Verified Portal proxy. |
| `FLAP_ROBINHOOD_PORTAL_LENS_ADDRESS` | *(empty)* | No separate Lens on RHC — `getTokenV7` lives on the Portal. Leave blank. |
| `FLAP_ROBINHOOD_TAX_HELPER_ADDRESS` | `0xb10bD267…203C` | Tax-token inspection helper. |
| `FLAP_ROBINHOOD_DEPLOYMENT_BLOCK` | `4180724` | Indexer backfill start block. |
| `FLAP_METADATA_GATEWAY` | `https://ipfs.io/ipfs` | Resolves the `meta` IPFS CID from `TokenCreated`. |
| `FLAP_API_BASE_URL` | *(empty)* | Optional off-chain Flap API; on-chain state is authoritative. |
| `FLAP_CONFIRMATION_BLOCKS` | `20` | Confirmations before treating a Flap event as final. |
| `FLAP_AUTO_LIST_ENABLED` | `false` | If `true`, keeper auto-lists graduates that clear the safety gates. Start manual. |
| `FLAP_MIN_POOL_LIQUIDITY_WETH` | `0.5` | Min pool depth (WETH) to list/trade a graduate. |
| `FLAP_MIN_POOL_LIQUIDITY_USDG` | *(empty)* | Alternate min-liquidity denomination (unused on native-ETH quote). |
| `FLAP_ALLOW_TAX_TOKENS` | `true` | Whether tax tokens may be listed. |
| `FLAP_MAX_BUY_TAX_BPS` / `FLAP_MAX_SELL_TAX_BPS` | `1000` / `1000` | Reject graduates whose buy/sell tax exceeds this. |

### Frontend (`NEXT_PUBLIC_*`) — set only after the relevant deploy

| Var | Set after |
|---|---|
| `NEXT_PUBLIC_FLAP_INTEGRATION_ENABLED` | Controlled beta / activation |
| `NEXT_PUBLIC_EXTERNAL_TRADE_GATEWAY_ADDRESS` | Gateway deploy |
| `NEXT_PUBLIC_EXTERNAL_REWARD_MANAGER_ADDRESS` | Reward deploy |
| `NEXT_PUBLIC_EXTERNAL_REWARD_VAULT_ADDRESS` | Reward deploy |

### Reward economics — leave blank until funded and reviewed

`EXTERNAL_TRADE_REWARD_FEE_BPS`, `EXTERNAL_TRADE_REWARD_FEE_CAP_BPS`, `REWARD_PAYOUT_SHARE_OF_FEE_BPS`, `MIN_REWARD_ELIGIBLE_TRADE_VALUE`, `MAX_REWARD_CREDITS_PER_WALLET_PER_EPOCH`, `REWARD_EPOCH_DURATION`.

### Deploy-time

`FEE_RECIPIENT` — reward-program treasury (defaults to the broadcaster/owner). Deployer address becomes contract owner.

---

## 3. Enabling sequence

Each step is a gate: do not advance until the prior step is verified. Rewards charge **zero fee** and mint **zero credits** until the very last activation call, so trading can go live long before rewards.

1. **Verify** — Run `scripts/verify-flap-robinhood.ts` (expect 10/10 pass, non-zero exit on any failure). Confirms chain id 4663, Portal bytecode/impl slot, `TokenCreated`/`LaunchedToDEX` topic0s, a real graduate resolves to `DEX(4)` with a WETH pool under the approved V2 factory. Machine config: `config/flap.robinhood.json`. Report: `docs/integrations/flap-robinhood-verification.md`.
2. **Backfill** — Point the indexer at `FLAP_ROBINHOOD_DEPLOYMENT_BLOCK` (4180724) and backfill `TokenCreated` + `LaunchedToDEX`. Confirm the graduate count matches on-chain (92 at verification time) and head lag is bounded before proceeding.
3. **Deploy** — `forge script contracts/script/DeployFlapIntegration.s.sol` on RHC (chain-gated). Record the six emitted addresses (registry, adapter, gateway, vault, rng, manager). Rewards are OFF at this point by construction.
4. **Fund** — Transfer **real** tokenized stock into `ExternalTradeRewardVault` via `fund(asset, amount)` and `configureAsset(asset, enabled, weightBps, lotSize, minInventory, reserved)`. Inventory is never substituted or synthesized — a basket asset with no held balance simply cannot pay out. Do not skip; an unfunded vault means every claim is a shortfall.
5. **Commit randomness** — Before starting each epoch, the operator commits `H(secret)` on `CommitRevealRandomnessProvider.commit(epochId, commitment)`. The secret is revealed **after** the epoch ends. Never reveal early; never reuse a secret.
6. **Controlled beta** — List a small set of verified graduates (`registry.listToken(...)`), keep `FLAP_INTEGRATION_ENABLED` scoped to internal/allowlisted wallets, and exercise real buy/sell round-trips through the gateway with tiny size. Confirm `ExternalTradeExecuted` fires with the expected `source`, slippage bounds hold, and tax-token behavior matches expectations.
7. **Activate** — Start the first epoch (`manager.startEpoch(duration)` — freezes the enabled vault subset into the epoch basket), then `gateway.setRewardConfig(rewardManager, true, rewardFeeBps)` to turn on the fee + credits. Finally set the `NEXT_PUBLIC_*` flags/addresses and flip `FLAP_INTEGRATION_ENABLED=true`. Rewards only begin accruing from this call forward.

---

## 4. Admin powers

All are owner / `DEFAULT_ADMIN_ROLE` operations (gateway/manager use `Ownable2Step`; registry/vault use OpenZeppelin AccessControl). None are automated.

### Gateway — `StockDotFunExternalTradeGateway`
- `pause()` / `unpause()` — halt/resume all `buy` and `sell` (`whenNotPaused`). First response to any anomaly.
- `setRewardConfig(rewardManager, rewardsActive, rewardFeeBps)` — enable/disable the reward fee. When inactive the fee is **0**. `rewardFeeBps` is bounded (`FeeTooHigh` on excess).
- `setFeeRecipient(recipient)` — redirect the collected fee.

### Registry — `FlapDexAdapterRegistry`
- `approveAdapter(adapter)` / `revokeAdapter(dexId)` — allow/disable a DEX adapter (e.g. the V2 adapter). Revoking disables routing for every token on that dexId.
- `listToken(token, pool, dexId, buyTaxBps, sellTaxBps)` — make a graduated token tradable.
- `setTokenEnabled(token, enabled)` — per-token pause without delisting.
- `setBlocked(target, isBlocked)` — block an address (compliance / abuse).

### Vault — `ExternalTradeRewardVault`
- `configureAsset(asset, enabled, weightBps, lotSize, minInventory, reserved)` — define/adjust the reward basket entry and its `minInventory` floor.
- `fund(asset, amount)` — deposit inventory (permissionless deposit; anyone may top up).
- `withdraw(asset, to, amount)` — admin-only pull of unallocated inventory (wind-down). `payout` is `MANAGER_ROLE`-only (the manager).

### Randomness — `CommitRevealRandomnessProvider`
- `commit(epochId, commitment)` — owner posts `H(secret)` before the epoch.
- `reveal(epochId, secret)` — owner reveals after the epoch; `seed = keccak256(secret, epochId)`. `BadReveal` if the secret doesn't match the commitment.

### Reward manager — `ExternalTradeRewardManager`
- `startEpoch(duration)` — freeze the enabled vault subset into a new epoch basket (`PreviousEpochActive` guards overlap; `EmptyBasket` if nothing enabled). This is the epoch **start**; the epoch **stops** automatically at `start + duration` (`epochEnded`).
- `setCampaign(active, minEligible, maxCredits, cooldown)` — eligibility knobs: min notional (`minEligibleValue`), per-wallet-per-epoch credit cap, per-wallet cooldown seconds.
- `setGateway(gateway)` / `setRandomness(rng)` — rewire attribution source / seed source.

---

## 5. Monitoring

| Signal | How to read it | Alert on |
|---|---|---|
| Indexer lag | Indexer head vs RPC `eth_blockNumber` on `INDEXER_RPC_URL` (RHC) | Lag beyond `FLAP_CONFIRMATION_BLOCKS` (20) sustained — stale token/graduation state. |
| Portal integrity | Re-run `scripts/verify-flap-robinhood.ts`; compare EIP-1967 impl slot + impl bytecode hash to `config/flap.robinhood.json` (`0x85facd83…186b`) | Any change — the proxy is upgradeable by its admin. **Pause on unexpected upgrade.** |
| Gateway status | `gateway.paused()`; watch `ExternalTradeExecuted`, `RewardConfigSet`, `FeeRecipientSet` | Unexpected pause state, or `RewardConfigSet` you did not initiate. |
| Graduation feed | `LaunchedToDEX` (topic0 `0x6e4f4763…ff7d`) + `getTokenV7(token).status == DEX(4)` | New graduate not yet listed; a listed token whose pool depth fell below `FLAP_MIN_POOL_LIQUIDITY_WETH`. |
| Inventory | `vault.available(asset)`, `vault.isPayable(asset)`; watch `InventoryShortfall` | Any `InventoryShortfall` event, or `available` near `minInventory`. Shortfall preserves the user's credits (no substitution) — replenish, don't paper over. |
| Epoch state | `manager.currentEpochId`, `epochActive(id)`, `epochEnded(id)`, `epochBasket(id)` | Epoch ended with **no committed/revealed seed** — claims are blocked (`SeedNotFinalized`) until reveal. |
| Randomness lifecycle | `rng.epochSeed(epochId)` → `(finalized, seed)`; events `Committed`, `Revealed` | Commit missing before an epoch starts; reveal missing after it ends. |
| Reward flow | Events `CreditRecorded`, `RewardClaimed`, `InventoryShortfall` | Credits accruing while `campaignActive` should be false, or vice-versa. |

---

## 6. Emergency response

- **Suspicious token / pool:** `registry.setTokenEnabled(token, false)` (keeps it listed but untradable) or `revokeAdapter(dexId)` to cut a whole DEX.
- **Abusive address:** `registry.setBlocked(target, true)`.
- **Contract-level anomaly / Portal upgrade:** `gateway.pause()` immediately, then investigate; re-run the verification script before unpausing.
- **Reward exploit or bad basket:** `manager.setCampaign(false, …)` and/or `gateway.setRewardConfig(manager, false, 0)` to drop the fee to zero and stop credits without touching trading.
- **Inventory drained:** `vault.fund(asset, amount)` to replenish; existing credits are preserved and claimable once inventory returns.

---

## 7. Standing trust assumptions

These do not go away once deployed — treat them as permanent operational duties:

- The Flap Portal is a **third-party upgradeable proxy**; its admin can change the implementation. Re-verify on a schedule and pause on unexpected upgrades.
- Randomness is **commit-reveal**, not VRF — no verified on-chain VRF exists on RHC. The operator must commit before each epoch and reveal after; a missed commit/reveal blocks claims but cannot forge a seed.
- The reward vault must be **funded with real tokenized stock**; there is no synthetic backing and no substitution on shortfall.
- Nothing here has been deployed, funded, or exercised with real value on mainnet.
