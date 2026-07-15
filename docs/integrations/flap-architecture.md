# StockDotFun × Flap — End-to-End Integration Architecture

This document describes how StockDotFun discovers, indexes, verifies, lists, and
attributes trades against **Flap** tokens on the **Robinhood Chain (RHC, chainId
4663)**, and how that feeds the reward/claim pipeline.

> **Status: not deployed.** The StockDotFun contracts described here are built,
> fork-tested, and unit-tested only. Nothing is deployed, funded, or live on
> mainnet. The integration ships **disabled** (`FLAP_INTEGRATION_ENABLED=false`).
> Only the **Flap Portal** and its graduated pools are pre-existing, on-chain,
> third-party infrastructure.

---

## 1. Component diagram

```
                          ROBINHOOD CHAIN (chainId 4663)
  ┌───────────────────────────────────────────────────────────────────────────┐
  │                                                                             │
  │   Flap Portal (TransparentUpgradeableProxy)                                 │
  │   0x26605f322f7fF986f381bB9A6e3f5DAb0bEaEb09                                 │
  │     impl Portal v5.14.16  0xd9C9981D784A3765D8264D6104650B901C4e36b1         │
  │     proxy admin           0x21f7f9B33dFD0dBc3a94C0EFA79F1546a1391FF5         │
  │     deploy block          4180724                                           │
  │                                                                             │
  │     emits TokenCreated ──────────────┐   emits LaunchedToDEX ──────────┐    │
  │     read getTokenV7(address)         │   (primary graduation event)    │    │
  └──────────────────────────────────────┼─────────────────────────────────┼───┘
                                          │                                 │
                     bonding curve (~5 ETH depth, native-ETH quote)         │
                                          │                                 │
                                          ▼                                 ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │   Uniswap V2-fork (post-graduation)                                         │
  │     factory  0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f                     │
  │     router   0x89e5DB8B5aA49aA85AC63f691524311AEB649eba                     │
  │     WETH      0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73                     │
  │     one Pair per graduated token (token / WETH)                             │
  └───────────────────────────────────────────────────────────────────────────┘
        ▲                                                        ▲
        │ verify pool exists / reserves                          │ swap
        │                                                        │
  ══════╪════════════════════════════════════════════════════════╪════════════
        │            StockDotFun contracts (BUILT, NOT DEPLOYED)  │
  ┌─────┴────────────────────────────────────────────────────────┴───────────┐
  │                                                                           │
  │   FlapDexAdapterRegistry ──► FlapV2DexAdapter ──► (V2 router/factory)     │
  │                                                                           │
  │   StockDotFunExternalTradeGateway                                         │
  │     • routes trades through the adapter                                   │
  │     • emits ExternalTradeExecuted(source = keccak256("FLAP"))            │
  │                       │                                                   │
  │                       ▼ attribution feed                                  │
  │   RewardEpochManager ── freezes per-epoch basket                          │
  │   CommitRevealRandomnessProvider ── seed = keccak256(secret, epochId)     │
  │   ExternalTradeRewardManager ── selects winners over frozen basket        │
  │   ExternalTradeRewardVault ── holds real stock inventory, pays claims     │
  │                                                                           │
  └───────────────────────────────────────────────────────────────────────────┘
        ▲                                                        │
        │ index events / read Portal                             │ claim
  ══════╪════════════════════════════════════════════════════════╪════════════
  ┌─────┴────────────────────────────────────────────────────────▼───────────┐
  │   StockDotFun off-chain services                                          │
  │     Indexer (TokenCreated / LaunchedToDEX) · Graduation verifier ·        │
  │     Auto-listing · Frontend (discovery, trade, claim)                     │
  └───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data flow

### 2.1 Discovery
- Watch the Portal for **`TokenCreated`**
  (`topic0 0x504e7f360b2e5fe33cbaaae4c593bc55305328341bf79009e43e0e3b7f699603`):
  `TokenCreated(uint256 ts, address creator, uint256 nonce, address token,
  string name, string symbol, string meta)`, where `meta` is the **IPFS CID** of
  token metadata.
- A newly created token is on the **bonding curve** — not yet graduated, not yet
  listable by StockDotFun.

### 2.2 Indexing
- For each known token, read canonical state from the Portal via
  **`getTokenV7(address)`** (there is **no separate Lens on RHC**; `getTokenV8Safe`
  is BNB-only).
- `TokenStatus` enum: `Invalid=0`, `Tradable=1`, `InDuel=2` (obsolete),
  `Killed=3` (obsolete), `DEX=4`, `Staged=5`.
- `Tradable=1` ⇒ still on the curve. `DEX=4` ⇒ graduated to the V2-fork pair.

### 2.3 Graduation verification
- Primary signal: **`LaunchedToDEX`**
  (`topic0 0x6e4f47630b8745b8cacbd44f42a8a33e7eea7cc08ef22fc7630f4f385784ff7d`):
  `LaunchedToDEX(address token, address pool, uint256 tokenAmount,
  uint256 quoteAmount)`. **All params are non-indexed** — decode from data, do
  not filter by indexed topics.
- Graduation occurs at **~5 ETH curve depth** (`CURVE_RH_TOSHI_5ETH`),
  **`migratorType = V2_MIGRATOR`**, native-ETH quote (`address(0)`, paired with
  WETH on the pool). Tax tokens are supported.
- Verify independently: confirm `getTokenV7` status is `DEX=4` **and** the
  `pool` from `LaunchedToDEX` exists in the V2 factory with live reserves. Only
  when both agree is a token treated as graduated.

### 2.4 Auto-listing
- A verified graduate is registered for trading through
  **`FlapDexAdapterRegistry`**, which maps the token to a **`FlapV2DexAdapter`**
  bound to the V2 router/factory.
- Listing is gated by `FLAP_INTEGRATION_ENABLED`; it is **`false`** by default.

### 2.5 Gateway trading
- All Flap trades route through **`StockDotFunExternalTradeGateway`**, which calls
  the adapter (V2 router swap, token ↔ WETH/native-ETH).
- On success the gateway emits
  **`ExternalTradeExecuted`** with `source = keccak256("FLAP")`. This event is the
  sole attribution primitive downstream.

### 2.6 Attribution
- The indexer consumes `ExternalTradeExecuted` and attributes notional volume to
  the trading wallet, per epoch.
- Attribution is **on-chain-event-derived only** — never inferred from the Flap
  API or pool scraping.

### 2.7 Rewards
- **`RewardEpochManager`** defines epochs and **freezes** the eligible basket at
  epoch close.
- **`CommitRevealRandomnessProvider`** supplies randomness (no verified VRF on
  RHC): operator commits `H(secret)` **before** the epoch, reveals `secret`
  **after**; `seed = keccak256(secret, epochId)`.
- **`ExternalTradeRewardManager`** selects winners:
  `keccak256(seed, epochId, user, nonce)` evaluated over the **frozen** epoch
  basket.
- Eligibility gates: minimum notional, per-wallet-per-epoch cap, cooldown, and an
  active-campaign gate. Fee is **0 when the campaign is inactive**.

### 2.8 Claims
- **`ExternalTradeRewardVault`** is **inventory-backed**: it pays out only **real
  held stock**. There is **no substitution** — if inventory is short, the shortfall
  **preserves the user's credits** (claim later) rather than paying a substitute
  asset.
- Users claim from the vault; the vault must be funded for any payout to succeed
  (it is not funded in the current state).

---

## 3. Source-of-truth priority

When sources disagree, resolve in this strict order:

1. **On-chain** — Portal `getTokenV7`, V2 factory/pair state, and the contract
   events (`TokenCreated`, `LaunchedToDEX`, `ExternalTradeExecuted`). Authoritative.
2. **Portal** — direct Portal reads/events (a subset of on-chain, called out
   separately because it is the canonical Flap state machine).
3. **Pools** — V2 pair reserves and derived price; used to corroborate
   graduation and pricing.
4. **API** — the Flap HTTP API; convenience/UX only, never for attribution or
   graduation truth.
5. **IPFS** — the `meta` CID (name/symbol/media); display metadata only, lowest
   trust.

Lower sources may enrich but never override a higher source.

---

## 4. How StockDotFun contracts map to the Flap protocol

| StockDotFun contract | Role | Flap protocol touchpoint |
| --- | --- | --- |
| `FlapV2DexAdapter` | Executes swaps against the graduated market | Uniswap V2-fork router `0x89e5DB8B…649eba` / factory `0x8bcEaA40…7937f`, WETH `0x0Bd7D308…AD73` |
| `FlapDexAdapterRegistry` | Maps token → adapter; the auto-listing surface | Consumes `LaunchedToDEX` + `getTokenV7` status `DEX=4` |
| `StockDotFunExternalTradeGateway` | Single entry point for Flap trades; attribution emitter | Wraps the adapter; emits `ExternalTradeExecuted(source=keccak256("FLAP"))` |
| `ExternalTradeRewardVault` | Holds real stock inventory; pays claims | Downstream of gateway attribution; no Flap dependency at claim time |
| `CommitRevealRandomnessProvider` | Randomness source (no VRF on RHC) | Independent of Flap; commit-before / reveal-after epoch |
| `RewardEpochManager` | Defines epochs, freezes baskets | Consumes attributed `ExternalTradeExecuted` volume |
| `ExternalTradeRewardManager` | Winner selection over frozen basket | Uses seed + epoch basket; no direct Flap call |

Deployment is chain-gated to **4663** via
`contracts/script/DeployFlapIntegration.s.sol`.

---

## 5. Trust assumptions (honest)

- The **Flap Portal is upgradeable** by its proxy admin
  (`0x21f7f9B33dFD0dBc3a94C0EFA79F1546a1391FF5`); its behavior can change.
- The **commit-reveal operator must commit before any trades** in an epoch;
  a late or withheld reveal stalls reward finalization for that epoch.
- The **reward vault must be funded** with real stock for claims to pay out — it
  is not funded in the current state.
- **No mainnet deploy, no funding, and no real trades have been performed.**

---

## 6. Verification & config references

- Verification script: `scripts/verify-flap-robinhood.ts` (reported **10/10 pass**).
- Config: `config/flap.robinhood.json`.
- Full verification report: `docs/integrations/flap-robinhood-verification.md`.

### Known-good reference data (RHC)

- Portal: `0x26605f322f7fF986f381bB9A6e3f5DAb0bEaEb09` (deploy block `4180724`).
- Stats at time of verification: **≥1000** Flap tokens created, **92** graduated.
- Verified graduates:
  - **WOBL** `0x76F80333B1d0abF3ff1636cdFb4efcE0FE747777` →
    pool `0x4AB8Abf127043779968e3Ef3B8c9A393DA4b1733`
  - **SERVO** `0x46941bE352545305a299975CDC54D9Fdf7Ce7777` →
    pool `0x02051a877477E810993c24aC295704065721C2D0`
