# Flap × StockDotFun — Known Risks

An honest register of the risks in the Flap integration on Robinhood Chain (chain id **4663**). Nothing here is deployed, live, or funded: the StockDotFun contracts are built and fork/unit tested only, and the integration ships **disabled** (`FLAP_INTEGRATION_ENABLED=false`). This document exists so that the trust assumptions are written down before any of that changes — not after.

Severity is a judgement of impact-if-realized, not probability.

---

## 1. Portal upgradeability (proxy admin)

**Severity: High. External, standing.**

The Flap Portal (`0x26605f322f7fF986f381bB9A6e3f5DAb0bEaEb09`) is a `TransparentUpgradeableProxy`. The implementation we verified is `0xd9C9981D784A3765D8264D6104650B901C4e36b1` (`Portal` v5.14.16), but the proxy admin (`0x21f7f9B33dFD0dBc3a94C0EFA79F1546a1391FF5`) can point the proxy at new logic **at any time, without our consent or notice**.

An upgrade can change: the bonding-curve math, the `getTokenV7` struct layout and selector behavior, event signatures/topics, graduation mechanics, or fee handling. Any of these can silently break our indexer, our price/quote reads, or our graduation detection — or change the meaning of a value we already trusted.

- We do not control the admin key and cannot audit its custody.
- We treat the verified implementation address and bytecode hash as a pinned baseline.
- Mitigation: re-verify the EIP-1967 implementation slot on a schedule; **pause the integration on any unexpected implementation change** rather than assuming the new logic is compatible. Re-run `scripts/verify-flap-robinhood.ts` after any suspected upgrade.

---

## 2. Commit-reveal trust (operator commits pre-epoch)

**Severity: High. Internal trust assumption.**

There is **no verified on-chain VRF** on Robinhood Chain. Reward randomness therefore uses **commit-reveal** (`CommitRevealRandomnessProvider`):

1. Operator commits `H(secret)` **before** the epoch opens.
2. Trades accrue into a frozen epoch basket.
3. Operator reveals `secret` **after** the epoch closes; `seed = keccak256(secret, epochId)`.
4. Reward selection = `keccak256(seed, epochId, user, nonce)` over the frozen basket.

This is honest about its limits:

- **The operator must commit before any trade in the epoch.** If the commit is late, the operator could observe trades and choose a favorable `secret` — the scheme's fairness depends entirely on commit-before-trades ordering, which is an operational guarantee, not a cryptographic one.
- **Reveal withholding is a live failure mode.** An operator who dislikes an outcome can refuse to reveal, stalling the epoch. There is no third party forcing the reveal.
- Commit-reveal resists prediction, not a malicious or coerced operator. It is strictly weaker than VRF and is a stopgap until a verifiable randomness source exists on 4663.

Mitigation: publish commit timestamps and hashes; treat missing/late commits and non-reveals as pause conditions; keep epochs short to bound exposure.

---

## 3. Tax / honeypot tokens

**Severity: High for end users; Medium for our inventory.**

Flap on RHC **supports tax tokens** (fee-on-transfer), and the graduation path (`V2_MIGRATOR`) migrates them to the Uniswap V2-fork. Consequences:

- Transfer taxes mean **received amount ≠ swapped amount**; any accounting that assumes 1:1 will drift. Quotes and settlement must use post-transfer balances.
- **Honeypots** — tokens that permit buys but block or punitively tax sells — are expressible on the curve and can graduate. A holder (including our reward vault) can be left unable to exit.
- Reward inventory is **only real, held stock** with no substitution, so a honeypot in inventory is a stuck asset, not a systemic loss — but it is still a loss of that position.

Mitigation: the reward basket is inventory-backed and curated, not open to arbitrary tokens; simulate a sell before treating any token as exitable; never assume nominal amounts for tax tokens.

---

## 4. Fake-liquidity clones (key off address, not name)

**Severity: High. Fundamental to permissionless launchpads.**

Anyone can create a Flap token with **any name and symbol**. `TokenCreated` carries attacker-controlled `name`, `symbol`, and `meta` (IPFS CID). A token called "AAPL" or reusing a real project's branding and metadata is trivial to mint, and a thin or rug-pullable pool can be stood up behind it.

**Rule: identity is the contract address, never the name/symbol/metadata.** Any UI, index, or reward-eligibility decision keyed on a string is spoofable.

- Match on the verified token address and its graduated pool address.
- Verify the pool's factory is the approved V2 fork (`0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f`) and that it pairs the token with WETH (`0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`).
- Displayed names must be clearly rendered as unverified user input.

---

## 5. Reorgs

**Severity: Medium.**

Reads and event indexing off recent blocks are exposed to chain reorganizations. A graduation (`LaunchedToDEX`), a trade, or a token creation observed at the chain tip can be reorged out and its effects (including derived pool addresses and reward accrual) invalidated.

- Do not treat tip-adjacent events as final.
- Require confirmation depth before acting on graduation detection or before finalizing an epoch basket that references recent trades.
- Reward finalization should draw from confirmed state only; keep epochs from closing on unconfirmed blocks.

---

## 6. RPC / indexer lag

**Severity: Medium.**

The integration depends on RPC availability and indexer freshness. Realistic failure modes:

- **Stale reads:** a lagging RPC returns an old `getTokenV7` status — e.g. still `Tradable(1)` after the token has actually graduated to `DEX(4)` — routing a trade to the curve instead of the migrated pool (or vice versa).
- **Indexer backlog:** delayed `TokenCreated` / `LaunchedToDEX` processing means the epoch basket or UI reflects a past state.
- **Provider disagreement:** multiple RPCs at different heights yield inconsistent answers.

Mitigation: read status immediately before routing and re-check post-graduation; bound acceptable lag and pause when exceeded; prefer confirmed state for anything financial.

---

## 7. Reward inventory shortfall

**Severity: Medium. By-design, but must be communicated.**

The reward system is **inventory-backed**: it can only distribute stock it actually holds. Eligibility is gated by min notional, per-wallet-per-epoch cap, cooldown, and a campaign-active flag; fee is **0 when the campaign is inactive**.

When a selected reward exceeds available inventory, the design **preserves the credit and does not substitute** another asset. This is deliberate — no silent swaps — but it means:

- A user can win a reward that cannot be paid out immediately.
- The vault must be **funded and monitored**; an unfunded or depleted vault produces outstanding credits, not payouts.
- **No vault funding has been done.** The credit-preservation behavior is a design property, not a promise of liquidity.

Mitigation: monitor inventory vs. outstanding credits; keep the campaign gate off when inventory cannot cover expected selections; treat credits as liabilities.

---

## 8. No-VRF randomness limits

**Severity: Medium (overlaps §2).**

Because there is no verified VRF on RHC, the randomness ceiling is set by commit-reveal. Restating the residual limits distinctly from the operator-trust point above:

- **Not verifiable by third parties in real time** the way an on-chain VRF proof is — fairness rests on published commits and honest reveal, checkable only after the fact.
- **Grinding resistance depends on commit ordering.** The `keccak256`-based selection is deterministic given the seed; its unpredictability is only as good as the secrecy and timing of the commit.
- If a verifiable randomness source later ships on 4663, `CommitRevealRandomnessProvider` is intended to be replaceable by it; until then, this is the accepted ceiling and the reward campaign stays gated behind it.

---

## 9. Unaudited contracts

**Severity: High until addressed.**

- **StockDotFun side:** `FlapV2DexAdapter`, `FlapDexAdapterRegistry`, `StockDotFunExternalTradeGateway`, `ExternalTradeRewardVault`, `CommitRevealRandomnessProvider`, `RewardEpochManager`, `ExternalTradeRewardManager` are **fork- and unit-tested, not audited, not deployed**. Test coverage is not an audit.
- **Flap side:** we rely on the Flap Portal and the Uniswap V2-fork (factory `0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f`, router `0x89e5DB8B5aA49aA85AC63f691524311AEB649eba`) as external dependencies whose internals we did not audit and cannot change.

Mitigation: independent audit of the StockDotFun contracts before any mainnet deploy or funding; keep the deploy chain-gated to 4663 (`contracts/script/DeployFlapIntegration.s.sol`); ship disabled until audited.

---

## 10. Remaining trust assumptions

Collected in one place, plainly:

- **The Flap Portal is upgradeable by its proxy admin**, whom we do not control (§1).
- **The commit-reveal operator must commit before trades and must reveal afterward** — an operational, not cryptographic, guarantee (§2, §8).
- **The reward vault must be funded** for credits to become payouts; it is not funded (§7).
- **No mainnet deploy, no funding, and no real trades have occurred.** All verification to date is on-chain reads of Flap's existing state plus our own fork/unit tests.
- **External addresses are pinned from on-chain verification, not trusted from social/docs**, and must be re-verified on a schedule (`scripts/verify-flap-robinhood.ts`, `config/flap.robinhood.json`; see `docs/integrations/flap-robinhood-verification.md`).

---

## Status

Built, fork/unit tested, **not deployed, not funded, disabled** (`FLAP_INTEGRATION_ENABLED=false`). This register is a precondition for enabling any part of it, and each risk above must have an owned mitigation before the corresponding phase goes live.
