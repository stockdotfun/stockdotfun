# Flap × Robinhood Chain — Incident Response Runbook

**Status:** integration ships **disabled** (`FLAP_INTEGRATION_ENABLED=false`). StockDotFun contracts are **built and fork/unit-tested, not deployed**; no mainnet funding or real trades have occurred. This runbook therefore describes the operating posture we intend once enabled, and the pause levers that exist by design. It is not a claim that any pause mechanism is live.

**Scope:** the Flap Portal on Robinhood Chain (chain id `4663`) and the StockDotFun contracts that read from / react to it — `FlapV2DexAdapter`, `FlapDexAdapterRegistry`, `StockDotFunExternalTradeGateway`, `ExternalTradeRewardVault`, `CommitRevealRandomnessProvider`, `RewardEpochManager`, `ExternalTradeRewardManager`.

**Source-of-truth priority for any incident call:** on-chain state > verified Flap contracts > official Flap docs. Never act on a social-media report alone; confirm on-chain first.

---

## 0. Two rules that override everything

1. **Pause first, diagnose second.** The cost of a false pause is bounded (users retry later, credits are preserved). The cost of trading through a live incident is not. When a detection signal fires and you are not yet sure, **pause and then investigate**. Do not wait for certainty to hit the switch.

2. **Preserve history.** Never delete, overwrite, or hard-reset indexer data, logs, epoch baskets, commit/reveal records, or reward-credit ledgers during an incident. Containment is achieved by **halting new activity**, not by erasing the record of what happened. Snapshot block heights, tx hashes, and event logs before any recovery step. A destroyed audit trail turns a recoverable incident into an unrecoverable dispute.

---

## 1. Pause levers (by design)

| Lever | What it stops | Reversible? | Where |
|---|---|---|---|
| **Global kill switch** `FLAP_INTEGRATION_ENABLED=false` | All Flap reads, quotes, trades, and reward accrual surfaced by StockDotFun | Yes (config flip) | `config/flap.robinhood.json` / env |
| **Adapter disable** in `FlapDexAdapterRegistry` | Routing through a specific DEX adapter (e.g. `FlapV2DexAdapter`) — blocks trade execution against a suspect pool/factory | Yes | registry (operator) |
| **Campaign gate off** | Reward selection and reward-fee accrual; **fee is 0 when the campaign is inactive** | Yes | `RewardEpochManager` / config |
| **Withhold reveal** (commit-reveal) | Reward selection for the affected epoch — no seed, no draw | Yes (epoch can be voided/re-run) | `CommitRevealRandomnessProvider` operator |
| **Freeze vault** | Reward payout while inventory/solvency is in question; **credits are preserved, not paid** | Yes | `ExternalTradeRewardVault` operator |

Pausing is layered: the global switch is the blunt instrument; the adapter/campaign/reveal/vault levers let you isolate one subsystem without taking the whole integration down. Prefer the narrowest lever that fully contains the signal, and escalate to the global switch when scope is unknown.

---

## 2. Incident matrix

| # | Incident | Primary detection signal | First pause |
|---|---|---|---|
| 1 | Unexpected Portal upgrade | EIP-1967 impl slot ≠ documented impl / version drift | Global switch |
| 2 | Malicious token listed | `TokenCreated` metadata / impersonation heuristics | Adapter + allowlist |
| 3 | Honeypot token | Sell reverts / asymmetric quotes on curve or pool | Adapter (token) |
| 4 | Pool drained | Pair reserves collapse post-`LaunchedToDEX` | Adapter (pool) |
| 5 | Inventory shortfall | Held stock < owed reward basket | Vault freeze |
| 6 | Randomness dispute | Reveal ≠ commit, or seed challenged | Withhold reveal |
| 7 | Gateway exploit suspicion | Anomalous `ExternalTradeExecuted` / accounting mismatch | Global switch |

---

## 3. Playbooks

### 3.1 Unexpected Portal upgrade

The Flap Portal (`0x26605f322f7fF986f381bB9A6e3f5DAb0bEaEb09`) is a `TransparentUpgradeableProxy`; its proxy admin (`0x21f7f9B33dFD0dBc3a94C0EFA79F1546a1391FF5`) can change the implementation at any time. This is a standing trust assumption, not a bug — but any change invalidates our verification of getter semantics and event layout.

- **Detection signal.** Scheduled re-verification finds the EIP-1967 implementation slot no longer equals the documented impl (`0xd9C9981D784A3765D8264D6104650B901C4e36b1`, `v5.14.16`), or the reported version string drifts, or an `Upgraded`/admin event appears from the proxy. `scripts/verify-flap-robinhood.ts` failing on the impl-slot check is the canonical trigger.
- **Immediate pause.** Flip the **global switch** (`FLAP_INTEGRATION_ENABLED=false`). All getter and event assumptions are now unverified; treat every read as untrusted until proven otherwise.
- **Containment.** Snapshot the new impl address, the upgrade tx hash, and block height. Diff the new implementation against the known-good bytecode hash. Confirm whether `getTokenV7(address)` still returns the same `TokenStateV7` layout and whether `TokenCreated` / `LaunchedToDEX` topic0s are unchanged (`0x504e7f36…9603` / `0x6e4f4763…ff7d`). Do not re-enable any adapter until layout is re-proven.
- **Recovery.** Re-run the full verification script against the new implementation. Update `config/flap.robinhood.json` and `lib/integrations/flap/*` only after the checks pass. Re-enable subsystems narrowest-first (reads → quotes → trades → rewards), watching for anomalies at each step.
- **Comms.** State plainly that Flap upgraded the Portal, that StockDotFun paused as a precaution, and that trading resumes only after re-verification. Do not speculate about Flap's intent.

### 3.2 Malicious token listed

- **Detection signal.** A newly `TokenCreated` token impersonates a real ticker (name/symbol collision), points `meta` (IPFS CID) at spoofed branding, or matches a known-bad creator/nonce pattern. StockDotFun only ever surfaces tokens on an explicit allowlist, so the risk is a bad token slipping *onto* the list, not the entire Portal.
- **Immediate pause.** Remove the token from the StockDotFun allowlist / disable its adapter route so no new quotes or trades can reference it. Do **not** attempt to touch the token on-chain.
- **Containment.** Record the token address, creator, nonce, and `meta` CID. Check `getTokenV7` status (`Tradable=1`, `DEX=4`, `Staged=5`; note `InDuel=2`/`Killed=3` are obsolete and should not be relied on). Scan the indexer for any StockDotFun user exposure.
- **Recovery.** Keep it delisted. If it was a genuine listing mistake rather than an attack, re-add only after out-of-band confirmation of the legitimate contract.
- **Comms.** Warn users the ticker is an impersonation, give the real contract address, and state that StockDotFun does not and cannot remove the token from Flap itself.

### 3.3 Honeypot token

- **Detection signal.** Buys succeed but sells revert or quote at near-zero; asymmetric `quoteExactInput` between buy and sell direction on the Portal curve, or transfer/tax behavior that traps holders on the migrated pool. Tax tokens are supported by Flap on RHC, so hostile tax logic is a real vector.
- **Immediate pause.** Disable the token's adapter route so StockDotFun stops quoting or executing against it.
- **Containment.** Simulate a round-trip (buy then sell) against the curve and, if graduated, the V2-fork pair before believing any quote. Flag the token as non-tradable in the index. Preserve the simulation traces.
- **Recovery.** Leave it disabled. There is no safe re-enable for a confirmed honeypot; only reinstate if the finding was a false positive proven by a clean round-trip simulation.
- **Comms.** Tell affected users the token blocks sells and that StockDotFun has stopped routing to it; do not imply StockDotFun can recover funds already trapped by the token's own code.

### 3.4 Pool drained

Applies after graduation (`LaunchedToDEX`), where trading moves to a Uniswap V2-fork pair (factory `0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f`, router `0x89e5DB8B5aA49aA85AC63f691524311AEB649eba`, native-ETH quote paired with WETH `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`).

- **Detection signal.** Pair reserves collapse or the WETH side is emptied; a large single-tx liquidity removal; price impact spikes to implausible levels for our order sizes.
- **Immediate pause.** Disable the **pool's adapter route** in the registry so no StockDotFun order can execute into the drained pair. Escalate to the global switch if you cannot yet tell whether the drain is isolated.
- **Containment.** Snapshot reserves at the drain block, the removing tx, and the LP holder. Confirm the pool address against `getTokenV7(token).pool` to be sure you are looking at the canonical pair (compare against known-good graduates, e.g. WOBL pool `0x4AB8Abf127043779968e3Ef3B8c9A393DA4b1733`, SERVO pool `0x02051a877477E810993c24aC295704065721C2D0`).
- **Recovery.** Only re-enable if liquidity is restored to a level that supports our size with acceptable slippage; otherwise keep the token routed off and mark it illiquid in the index.
- **Comms.** Report that the on-chain pool was drained, that StockDotFun halted routing to it, and the affected token — without accusing a party absent on-chain proof.

### 3.5 Inventory shortfall

Rewards are **inventory-backed**: only real, currently-held stock can be distributed, and there is **no substitution**. A shortfall is a solvency event for the reward program, not a trading halt.

- **Detection signal.** The sum of owed reward positions for an epoch exceeds actual held inventory in `ExternalTradeRewardVault`; a reconciliation job reports held < owed.
- **Immediate pause.** **Freeze the vault** so no payouts execute against insufficient inventory. Optionally turn the **campaign gate off** to stop further accrual (fee drops to 0 while inactive).
- **Containment.** By design, a shortfall **preserves credits** — user entitlements remain recorded and are not silently reduced or swapped for another asset. Snapshot the owed ledger and held balances at the reconciliation block.
- **Recovery.** Replenish inventory to cover owed credits, reconcile, then unfreeze and pay against preserved credits. Do not zero out or overwrite credits to force balance.
- **Comms.** Tell recipients payouts are paused pending inventory top-up, that their credits are intact and will be honored, and give a reconciliation timeframe. Never imply rewards were paid when they were only credited.

### 3.6 Randomness dispute

There is **no verified on-chain VRF on RHC**, so reward selection uses **commit-reveal**: the operator commits `H(secret)` before the epoch, reveals `secret` after it closes, and the seed is `keccak256(secret, epochId)`. Winner selection is `keccak256(seed, epochId, user, nonce)` over the **frozen** epoch basket.

- **Detection signal.** A revealed `secret` does not hash to the earlier commitment; a reveal is missing or late; a user disputes the draw; or the epoch basket appears to have changed after freeze.
- **Immediate pause.** **Withhold the reveal / hold the draw** for the affected epoch and turn the campaign gate off if selection is downstream-blocking.
- **Containment.** Preserve the commitment hash, its commit block, the (attempted) reveal, the frozen basket snapshot, and the eligibility parameters in force (min notional, per-wallet-per-epoch cap, cooldown, campaign-active gate). The frozen basket is the whole point — do not recompute it from live state.
- **Recovery.** If commitment and reveal reconcile, publish the derivation (`secret → seed → selection`) so anyone can recompute the winners. If they do **not** reconcile, void the epoch and re-run selection with a fresh commit over the same preserved basket. Never re-roll a seed to change an outcome.
- **Comms.** Publish the commit hash, the reveal, and the selection formula so the draw is independently verifiable. State clearly whether the epoch was honored or voided-and-rerun, and why.

### 3.7 Gateway exploit suspicion

`StockDotFunExternalTradeGateway` emits `ExternalTradeExecuted` with `source = keccak256("FLAP")` and feeds the reward pipeline. A compromised or misbehaving gateway can mint reward eligibility from trades that did not really happen, or double-count real ones.

- **Detection signal.** `ExternalTradeExecuted` volume or notional diverges from the underlying Portal/pool trades; events with a wrong `source`; duplicate events for one trade; eligibility accruing without matching on-chain settlement.
- **Immediate pause.** Flip the **global switch** and freeze the vault. Treat the whole reward accounting path as suspect until proven otherwise. This is a high-severity default because it touches funds owed to users.
- **Containment.** Snapshot the emitted events, the corresponding Portal/pool txs, and the reward ledger deltas. Reconcile each `ExternalTradeExecuted` against a real settled trade; quarantine any that cannot be matched. Do not delete quarantined records.
- **Recovery.** Fix or redeploy the gateway, re-verify event emission end-to-end on a fork, back out only the credits proven fraudulent (preserving the record of the reversal), and re-enable narrowest-first.
- **Comms.** Disclose that reward accounting was paused pending an integrity check, and — once reconciled — exactly which credits stand and which were reversed and why.

---

## 4. Severity & escalation

| Severity | Definition | Default first lever |
|---|---|---|
| **SEV-1** | User funds or owed credits at risk, or trust assumptions invalidated (Portal upgrade, gateway exploit, pool drain reachable by our routing) | Global switch, then isolate |
| **SEV-2** | Contained to one token/pool with no cross-user exposure (honeypot, single malicious listing) | Adapter/token disable |
| **SEV-3** | Program-integrity question with credits preserved (inventory shortfall, randomness dispute) | Vault freeze / withhold reveal |

When severity is uncertain, treat it as one level higher. Escalation is cheap; under-reaction is not.

---

## 5. Post-incident

- Write a timeline from the **preserved** record: detection block/tx, pause action and time, containment steps, recovery, re-enable.
- Re-run `scripts/verify-flap-robinhood.ts` (10/10) before declaring the integration healthy; a green verification is the gate to lifting the global switch.
- Fold any new detection signal into scheduled monitoring so the same class of incident trips a pause automatically next time.
- Update `docs/integrations/flap-robinhood-verification.md` if any verified fact (address, impl, event layout, enum) changed as a result.

---

## 6. Honest limitations

- Every pause lever above is a **design intent** of contracts that are built but **not deployed**; none is live, and no inventory or vault is funded.
- On-chain pause reach is bounded to StockDotFun's own contracts and routing. **We cannot pause, alter, or upgrade the Flap Portal**, cannot reverse trades users make directly on Flap, and cannot recover funds trapped by a token's own code.
- The Portal remains upgradeable by its proxy admin; re-verification on a schedule is the only defense, and an unexpected upgrade is always a pause-first event.

See also: `docs/integrations/flap-robinhood-verification.md` (verified facts), `config/flap.robinhood.json` (machine config), `scripts/verify-flap-robinhood.ts` (re-verification gate).
