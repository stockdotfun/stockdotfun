# Flap × StockDotFun — Reward System

**Status: DESIGN + BUILT, NOT DEPLOYED.** The reward contracts are written and fork/unit tested. Nothing is deployed, funded, or live. No real reward has ever been paid. The integration ships **disabled** (`FLAP_INTEGRATION_ENABLED=false`) and, even when enabled, the campaign defaults to the **paused** state until an operator explicitly funds inventory and activates an epoch.

This document specifies the reward economics and on-chain mechanics for rewarding users who trade Flap tokens on Robinhood Chain (chain id `4663`) through StockDotFun. It is the companion to the contract verification report, `docs/integrations/flap-robinhood-verification.md`.

Configurable economic parameters (fee bps, notional minimums, per-wallet caps, cooldowns, epoch duration) are intentionally left **blank pending review** below. They are policy decisions, not verified facts, and are set at deploy time.

---

## 1. What a reward is

A reward is a **real, held tokenized-stock position** transferred to a user out of a pre-funded inventory vault. Rewards are:

- **Inventory-backed.** The vault can only pay out stock it actually holds. There is no minting, no IOU, no synthetic exposure. If the selected asset is not in inventory in sufficient quantity, the user's credit is **preserved** (see §6, shortfall) — the system never substitutes a different asset to force a payout.
- **Random, over a frozen basket.** Which stock a user receives is drawn deterministically from a random seed over the basket of assets that the vault held at epoch freeze.
- **Earned by trading.** Eligibility accrues from qualifying Flap trades routed through StockDotFun during an epoch.

Rewards are a promotional distribution of assets the protocol already owns. They are **not** investment advice, not a yield product, and not a promise of value.

---

## 2. Funding sources

There are exactly two funding sources, and both are disclosed:

1. **Pre-funded inventory.** An operator deposits real tokenized-stock positions into the `ExternalTradeRewardVault` before a campaign. This is the entire pool that can ever be paid out. The vault cannot pay what it was not funded with.
2. **Disclosed reward fee.** A reward fee (in bps, **value pending review**) may be taken on qualifying trades routed through the gateway and used to replenish inventory. The fee is disclosed up front. **When the campaign is inactive or paused, the fee is `0`** — users are never charged a reward fee for a campaign that cannot pay out.

No other funding source exists. There is no treasury backstop and no external subsidy assumed anywhere in the design.

---

## 3. Contracts

Built and fork/unit tested; **not deployed**. Deployed together, chain-gated to `4663`, via `contracts/script/DeployFlapIntegration.s.sol`.

| Contract | Role |
|---|---|
| `StockDotFunExternalTradeGateway` | Routes/records qualifying external Flap trades. Emits `ExternalTradeExecuted` with `source = keccak256("FLAP")`. The single source of truth for what counts as a qualifying trade. |
| `FlapV2DexAdapter` | Executes trades against the Flap Uniswap-V2-fork graduation pools (factory `0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f`, router `0x89e5DB8B5aA49aA85AC63f691524311AEB649eba`, WETH `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`). |
| `FlapDexAdapterRegistry` | Maps a trade venue to its adapter, so the gateway resolves the correct adapter per token. |
| `ExternalTradeRewardVault` | Custodies the pre-funded stock inventory. Only source of payout. Enforces inventory-backed transfers. |
| `CommitRevealRandomnessProvider` | Supplies per-epoch randomness by commit-reveal (see §4). No VRF is used. |
| `RewardEpochManager` | Owns epoch lifecycle: open → accrue → freeze basket → reveal → claim. |
| `ExternalTradeRewardManager` | Ties it together: reads qualifying trades, applies eligibility rules, performs deterministic selection, authorizes vault payout. |

Read Flap token state via `getTokenV7(address)` **directly on the Portal** (`0x26605f322f7fF986f381bB9A6e3f5DAb0bEaEb09`); there is no separate Lens on RHC and `getTokenV8Safe` is BNB-only.

---

## 4. Randomness — commit-reveal, no VRF

**There is no verified on-chain VRF / randomness oracle on Robinhood Chain.** Rather than trust an unverified source, the system uses **commit-reveal**:

1. **Commit (before the epoch).** The operator commits `H = keccak256(secret)` on-chain via `CommitRevealRandomnessProvider` **before any trade in the epoch is accrued**. The secret is not yet known to anyone else.
2. **Trades accrue (during the epoch).** Users trade. Eligibility accumulates. Because the commit is already fixed, no one — including the operator — can bias the outcome by choosing the secret after seeing the trades.
3. **Reveal (after the epoch).** The operator reveals `secret`. The provider checks `keccak256(secret) == H`, then derives the epoch seed:

   ```
   seed = keccak256(secret, epochId)
   ```

The commit-before-trades ordering is the security-critical invariant. If the operator fails to commit before trades accrue, the epoch cannot produce an unbiased seed and must not distribute — the honest outcome is the campaign staying **paused** (§7).

**Trust assumption:** the operator must (a) commit before trades and (b) actually reveal. A withheld reveal stalls distribution but **cannot** redirect or steal rewards — inventory stays in the vault and user credits are preserved until a valid reveal occurs (or an epoch is voided and credits roll forward).

---

## 5. Deterministic selection

Once the epoch seed exists, selection is **fully deterministic and independently reproducible**. For each eligible user and each reward draw:

```
draw = keccak256(seed, epochId, user, nonce)
```

`draw` is reduced over the **frozen epoch basket** — the exact set (and weights) of assets the vault held at epoch freeze — to pick the asset. Because `seed`, `epochId`, `user`, and `nonce` are all on-chain or revealed, anyone can recompute every selection and verify the vault paid exactly what the algorithm dictates. The basket is frozen at epoch boundary so that inventory movement after freeze cannot change an already-earned outcome.

---

## 6. Eligibility & anti-wash-trading

A trade qualifies for reward accrual only if it clears **all** gates. Numeric thresholds are **pending review**.

| Gate | Rule | Value |
|---|---|---|
| Campaign active | Epoch must be open and the campaign active. If not, fee is `0` and nothing accrues. | — |
| Minimum notional | Trade size must exceed a floor to prevent dust-spam farming. | *pending review* |
| Per-wallet-per-epoch cap | A wallet can accrue at most a capped amount of eligibility per epoch. | *pending review* |
| Cooldown | Minimum time between a wallet's reward-qualifying trades. | *pending review* |
| Reward fee | Disclosed fee (bps) on qualifying trades; `0` when inactive/paused. | *pending review* |

These gates exist specifically to make **wash trading uneconomic**: the min-notional floor kills dust farming, the per-wallet-per-epoch cap bounds any single actor's share, and the cooldown throttles rapid self-trading. A wallet cycling the same capital back and forth cannot inflate its expected reward past the per-wallet cap, and pays the disclosed fee on every qualifying leg.

**Inventory-backed shortfall rule:** if a selected asset is under-inventoried at claim time, the user's credit is **preserved** and rolls forward — the system does **not** substitute a different stock to force a payout. Payout integrity (you get what the algorithm selected, out of real inventory, or nothing yet) takes priority over payout completeness.

---

## 7. Epoch & claim flow

```
        ┌── operator COMMIT  H = keccak256(secret)   (before any accrual)
        │
  OPEN ─┼── users trade → gateway emits ExternalTradeExecuted (source=FLAP)
        │        eligibility accrues, gated by §6
        │
 FREEZE ┼── basket frozen: assets + weights the vault holds now are locked
        │
 REVEAL ┼── operator reveals secret; seed = keccak256(secret, epochId)
        │
 SELECT ┼── per user: draw = keccak256(seed, epochId, user, nonce) over frozen basket
        │
  CLAIM ┴── user claims; vault transfers real inventory
                  └── if under-inventoried: credit preserved, rolls forward (no substitution)
```

The **"campaign paused" honest state** is a first-class outcome, not an error. The campaign is paused whenever any precondition is unmet — integration disabled, vault unfunded, no valid commit before trades, no reveal, or operator choice. While paused:

- the reward fee is **`0`**,
- no eligibility accrues,
- no payout occurs,
- existing credits are preserved.

The system is designed to **prefer pausing over paying incorrectly**. Displaying "campaign paused" truthfully is the intended behavior when the machinery cannot guarantee a correct, inventory-backed, unbiased distribution.

---

## 8. Configurable values (pending review)

Set at deploy time; **not yet decided**, hence blank here. None are verified facts.

| Parameter | Unit | Value |
|---|---|---|
| Reward fee | bps | *pending review* |
| Minimum trade notional | quote token | *pending review* |
| Per-wallet-per-epoch eligibility cap | quote token | *pending review* |
| Cooldown between qualifying trades | seconds | *pending review* |
| Epoch duration | seconds | *pending review* |
| Reward draws per eligible user | count | *pending review* |
| Inventory basket composition & weights | per-asset | *pending review* |

---

## 9. Trust assumptions (honest)

- **Nothing is deployed, funded, or live.** No mainnet deploy, no funded inventory, no real trade, no reward ever paid.
- **The Flap Portal is upgradeable** by its proxy admin (`0x21f7f9B33dFD0dBc3a94C0EFA79F1546a1391FF5`). An upgrade can change Portal behavior the integration depends on; the integration must re-verify the implementation on a schedule and pause on unexpected upgrades.
- **The commit-reveal operator is trusted for liveness, not for integrity.** They must commit before trades and reveal after. Failure stalls distribution but cannot redirect rewards; withholding a reveal cannot drain the vault.
- **The vault must be funded** before any campaign can pay out. An unfunded vault means the campaign stays paused.
- **No VRF** exists on RHC; randomness security rests entirely on the commit-before-trades ordering of §4.

---

## 10. Enablement gate

The reward system activates only when **all** of the following hold, each separately verified:

1. `FLAP_INTEGRATION_ENABLED=true` (config `config/flap.robinhood.json`; verifier `scripts/verify-flap-robinhood.ts`, currently 10/10).
2. All reward contracts deployed via `contracts/script/DeployFlapIntegration.s.sol` (chain-gated `4663`).
3. `ExternalTradeRewardVault` funded with real inventory.
4. Configurable values (§8) reviewed and set.
5. A valid commit posted **before** the first accrued trade of the epoch.

Until every item is true, the honest state is **campaign paused**, fee `0`, no payouts.

## Self-funding inventory: trading fees → stock (ExternalFeeStockAccumulator)

The reward inventory funds itself from trading fees — no manual pre-funding required.

Flow (fork-tested end-to-end):
1. A buy/sell of a graduated Flap token through `StockDotFunExternalTradeGateway`
   skims the disclosed reward fee in native ETH.
2. The gateway's `feeRecipient` is set to `ExternalFeeStockAccumulator`, so fees
   accumulate there.
3. A keeper (`scripts/flap-fee-accumulator-keeper.mjs`) periodically calls
   `accumulate(stock, ethAmount, minStockOut, deadline)`, which wraps the ETH and
   converts it via the **verified** `UniswapV4RouterAdapter` (WETH→USDG→stock),
   delivering the tokenized stock straight into `ExternalTradeRewardVault`. The
   keeper spreads conversions across the enabled basket by weight, under the
   adapter's per-conversion size cap.
4. The vault's `available()` reads its live balance, so accumulated stock is
   immediately counted as payable reward inventory.

Properties: batched (amortizes gas + slippage); routes only to verified stock
routes (the adapter enforces the whitelist + slippage); the accumulator custodies
only pending ETH between conversions; `KEEPER_ROLE`-gated; admin `rescue*` for a
retired route. Proof: `contracts/test/fork/ExternalFeeAccumulatorFork.t.sol`
(`test_fullLoop_realTradeFeeBecomesStockInventory` — a real WOBL trade's fee
becomes real TSLA in the vault). Wired by `DeployFlapIntegration.s.sol`.
