# Flap Indexing Plan — StockDotFun × Flap (Robinhood Chain 4663)

This document specifies how StockDotFun indexes the Flap Portal on Robinhood Chain (chain id **4663**): which contract and block to start from, which events to ingest, how graduations are **validated** before they are trusted, the persistence model, and the correctness properties (idempotency, composite keys, reorg handling, metadata safety) the indexer must uphold.

Nothing here is deployed, live, or funded. The integration ships **disabled** (`FLAP_INTEGRATION_ENABLED=false`); this is the plan the indexer implements, not a running system.

Source-of-truth priority: **on-chain state > verified Flap contracts > official Flap docs**. Addresses below are the ones already verified in `docs/integrations/flap-robinhood-verification.md` — do not substitute values from any other source.

---

## 1. Scope & starting point

| Parameter | Value |
|---|---|
| Chain id | `4663` (Robinhood Chain) |
| Indexed contract | Flap **Portal** (proxy) `0x26605f322f7fF986f381bB9A6e3f5DAb0bEaEb09` |
| Portal implementation | `Portal` v5.14.16 `0xd9C9981D784A3765D8264D6104650B901C4e36b1` |
| Proxy admin (trust assumption) | `0x21f7f9B33dFD0dBc3a94C0EFA79F1546a1391FF5` |
| **Start block** | **4180724** (Portal deploy block) |
| Read method | `getTokenV7(address)` **on the Portal** — no separate Lens on RHC; `getTokenV8Safe` is BNB-only |

The indexer scans Portal logs from block **4180724** forward. There is no reason to scan earlier blocks: the Portal did not exist before its deploy block, so `fromBlock = 4180724` is both correct and the cheapest backfill.

Reads for validation go **directly to the Portal** via `getTokenV7`. `TokenStatus`: `Invalid=0`, `Tradable=1` (bonding curve), `InDuel=2` (obsolete), `Killed=3` (obsolete), `DEX=4` (graduated), `Staged=5`.

---

## 2. Events ingested

Only two Portal events drive indexing. Both are decoded from Portal logs; **both carry non-indexed params where noted**, so filter by `topic0` (event signature) and decode the data region — do not filter by indexed topics that do not exist.

### 2.1 `TokenCreated` — creation

```
TokenCreated(
  uint256 ts,
  address creator,
  uint256 nonce,
  address token,
  string  name,
  string  symbol,
  string  meta        // IPFS CID
)
```

- `topic0` = `0x504e7f360b2e5fe33cbaaae4c593bc55305328341bf79009e43e0e3b7f699603`
- `meta` is the IPFS CID for off-chain token metadata (see §7). Confirm the indexed/non-indexed split against a real on-chain log before relying on topic positions.
- Produces / upserts a **`FlapToken`** row.

### 2.2 `LaunchedToDEX` — graduation (primary)

```
LaunchedToDEX(
  address token,
  address pool,
  uint256 tokenAmount,
  uint256 quoteAmount
)
```

- `topic0` = `0x6e4f47630b8745b8cacbd44f42a8a33e7eea7cc08ef22fc7630f4f385784ff7d`
- **All params are non-indexed** (verified on-chain) — decode from the data region.
- This is the **primary graduation signal**. It is a *candidate*, not a confirmed graduation: it starts the validation pipeline in §4, it does not by itself mark a token graduated.

---

## 3. On-chain migration target (what a valid graduation looks like)

When a Flap token graduates on RHC it migrates to a **Uniswap V2-fork pair**. A `LaunchedToDEX` event is only trustworthy if the referenced pool matches this shape:

| Property | Expected |
|---|---|
| Pair factory | `0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f` |
| Router | `0x89e5DB8B5aA49aA85AC63f691524311AEB649eba` |
| Quote token (curve) | native ETH — `address(0)` |
| Paired ERC-20 in pool | WETH `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| Graduation depth | ~5 ETH (`CURVE_RH_TOSHI_5ETH`) |
| Migrator type | `V2_MIGRATOR` |
| Tax tokens | supported |

Reference verified graduates (for fixtures / regression): **WOBL** `0x76F80333B1d0abF3ff1636cdFb4efcE0FE747777` pool `0x4AB8Abf127043779968e3Ef3B8c9A393DA4b1733`; **SERVO** `0x46941bE352545305a299975CDC54D9Fdf7Ce7777` pool `0x02051a877477E810993c24aC295704065721C2D0`. On RHC, >=1000 tokens created and 92 graduated at the time of verification.

---

## 4. Graduation validation pipeline

A `LaunchedToDEX` log is **never** treated as a finished graduation on receipt. It advances a state machine, and only the terminal state is trusted for downstream trading/rewards. Each stage is gated; failure at any stage parks the record for retry or manual review rather than promoting it.

```
LaunchedToDEX candidate
        │
        ▼
[1] Confirmations       wait N block confirmations past the log's block
        │                (guards against reorg-orphaned logs — see §6)
        ▼
[2] Portal status       getTokenV7(token).status == DEX(4)
        │                and getTokenV7(token).pool == log.pool
        ▼
[3] Pool identity       pool has non-empty bytecode
        │                pool.factory() == 0x8bcEaA40…937f
        │                {token0,token1} == {token, WETH 0x0Bd7…AD73}
        ▼
[4] Liquidity           getReserves() shows both reserves > 0
        │                WETH-side reserve is sane (non-dust; ~5 ETH depth expected)
        ▼
VERIFIED_GRADUATED
```

Stage detail:

1. **Confirmations.** Hold the candidate until it is buried under `N` confirmations (config; conservative on a young chain). Prevents acting on a graduation that a reorg later removes.
2. **Portal status cross-check.** Independently call `getTokenV7(token)` on the Portal and require `status == DEX(4)` **and** that the Portal-reported `pool` equals the pool in the event. This defeats a spoofed or mis-decoded event: the Portal is the authority on whether the token actually graduated.
3. **Pool identity / bytecode checks.** The pool address must (a) contain deployed bytecode, (b) report `factory() == 0x8bcEaA40…937f` (the approved V2 fork), and (c) have its `token0`/`token1` set be exactly `{token, WETH}`. A pool that pairs against the wrong asset, or was minted by an unapproved factory, is rejected.
4. **Liquidity checks.** `getReserves()` must show both sides positive with a non-dust WETH reserve consistent with the ~5 ETH graduation depth. Zero/dust liquidity is treated as not-yet-graduated (retry) rather than verified.

Only when all four pass does the record become **`VERIFIED_GRADUATED`**. Downstream StockDotFun trading and reward logic must key off this terminal status — not off the raw event.

---

## 5. `FlapIntegrationStatus` enum

The lifecycle status persisted per token / graduation record. It is deliberately finer-grained than the Flap `TokenStatus` so validation progress and failure modes are observable.

| Value | Meaning |
|---|---|
| `INDEXED` | `TokenCreated` seen and persisted; token is on the bonding curve. |
| `METADATA_PENDING` | Awaiting IPFS metadata resolution/validation (§7). |
| `METADATA_VALIDATED` | Off-chain metadata resolved and passed all safety checks. |
| `METADATA_REJECTED` | Metadata failed validation (bad CID / MIME / size / schema / URL). Token still tradable on-curve; UI degrades gracefully. |
| `GRADUATION_CANDIDATE` | `LaunchedToDEX` observed; validation pipeline (§4) not yet complete. |
| `AWAITING_CONFIRMATIONS` | Candidate buried under fewer than `N` confirmations. |
| `GRADUATION_VALIDATING` | Running Portal-status / pool / liquidity checks. |
| `VERIFIED_GRADUATED` | All §4 checks passed; trusted DEX target. Terminal (success). |
| `GRADUATION_REJECTED` | A validation stage failed; parked for retry / manual review. |
| `REORG_INVALIDATED` | A previously indexed log was orphaned by a reorg; record rolled back (§6). |

Statuses are monotonic in the happy path (`INDEXED → … → VERIFIED_GRADUATED`); reorgs are the only edge that walks a record backwards, and they route through `REORG_INVALIDATED` explicitly rather than silently mutating a terminal row.

---

## 6. Persistence model

Four tables. All writes are **idempotent upserts** keyed on natural, reorg-stable identifiers so that re-scanning a block range (backfill re-runs, restarts, reorg replays) converges to the same state.

### 6.1 `FlapToken`
One row per created token.

- **Primary key:** `tokenAddress` (unique per chain; the address is deterministic and never reused).
- Fields: `creator`, `nonce`, `name`, `symbol`, `metaCid`, `createdTs`, `createdBlock`, `createdTxHash`, `createdLogIndex`, `status: FlapIntegrationStatus`, metadata columns (§7), timestamps.
- Provenance columns (`createdBlock`, `createdTxHash`, `createdLogIndex`) exist so a reorg can locate and invalidate rows by the block that produced them.

### 6.2 `FlapGraduation`
One row per validated (or in-flight) graduation.

- **Composite key:** `(tokenAddress, poolAddress)` — a token has at most one live graduation, and pinning the pool makes the row self-describing and defeats event replays that carry a different pool.
- Fields: `tokenAmount`, `quoteAmount`, `status`, `confirmations`, `eventBlock`, `eventTxHash`, `eventLogIndex`, `verifiedAt`, plus the recorded results of each §4 check.
- Idempotency: the emitting `(txHash, logIndex)` is stored and uniquely constrained so the same log cannot create two graduation rows.

### 6.3 `FlapPool`
One row per validated DEX pool.

- **Primary key:** `poolAddress`.
- Fields: `tokenAddress`, `pairedToken` (must be WETH), `factory` (must be the approved V2 fork), `token0`, `token1`, `reserve0`, `reserve1`, `bytecodeHash`, `validatedAt`.
- Recording `bytecodeHash` and `factory` lets later runs detect if a pool address was re-pointed or fails re-validation.

### 6.4 `StockDotFunExternalTrade`
One row per external (Flap-sourced) trade StockDotFun observes/executes against a graduated pool.

- **Composite key:** `(txHash, logIndex)` — the on-chain event is the natural unique identity; re-ingesting the same log is a no-op upsert.
- Fields: `tokenAddress`, `poolAddress`, `trader`, `side`, `amountIn`, `amountOut`, `source` (`keccak256("FLAP")`), `block`, `blockTimestamp`, and linkage to reward accounting.
- This mirrors the on-chain `ExternalTradeExecuted` shape emitted by `StockDotFunExternalTradeGateway` (built, not deployed).

### 6.5 Idempotency & composite keys — invariants

- Every ingest is an **upsert on a natural key**, never a blind insert. Replaying block range `[a,b]` any number of times yields identical rows.
- Log-derived rows carry a `(txHash, logIndex)` uniqueness constraint so one log ⇒ at most one row.
- Address-keyed rows (`FlapToken`, `FlapPool`) rely on address non-reuse.
- The indexer persists a **cursor** (last fully-processed block + block hash). On restart it resumes from the cursor, re-processing the last `N` (confirmation-depth) blocks to catch late reorgs.

### 6.6 Reorg handling

- The indexer stores the **block hash** alongside the block number for every processed height. Before extending the chain it checks that the parent hash of the next block matches the stored hash at the previous height.
- On mismatch (reorg): rewind the cursor to the last common ancestor, and for every row whose `*_block` is now orphaned, transition it to `REORG_INVALIDATED` (or roll back to its prior status) rather than deleting silently. Re-scan forward on the canonical chain; idempotent upserts re-establish the correct rows.
- The confirmation gate in §4 stage 1 means graduations are not promoted to `VERIFIED_GRADUATED` until they are deep enough that a reorg is unlikely to orphan them — bounding how much validated state a reorg can ever unwind.
- **Trust note:** the Portal is upgradeable by its proxy admin. The indexer re-verifies the Portal implementation on a schedule and should pause on an unexpected upgrade rather than trusting `getTokenV7` blindly.

---

## 7. Metadata resolution & validation

`TokenCreated.meta` is an **IPFS CID** pointing at off-chain JSON (name, symbol, image, socials). It is untrusted third-party content and is validated before it is stored or surfaced. Metadata is resolved asynchronously; a token is fully tradable on the curve regardless of metadata outcome (status `METADATA_REJECTED` degrades the UI, it does not block trading).

Validation gate (all must pass ⇒ `METADATA_VALIDATED`; any failure ⇒ `METADATA_REJECTED`):

1. **CID validity.** Parse and canonicalize the CID; reject malformed CIDs. Fetch through a pinned/allow-listed IPFS gateway; never dereference an attacker-supplied HTTP(S) URL as the gateway.
2. **Size cap.** Enforce a maximum response size; abort the fetch past the cap. Rejects decompression/oversize DoS.
3. **MIME / content type.** Require the expected type (JSON for the metadata document; image types for referenced images). Reject anything else.
4. **Schema.** Validate the JSON against the expected token-metadata schema; reject unknown-critical or malformed structures. Extra fields are ignored, not executed.
5. **URL safety.** Any URLs inside the metadata (image, socials) must be scheme-checked (`https:` / `ipfs:` only), host-sanitized, and length-bounded. No `javascript:`, `data:`, or intranet/loopback targets. URLs are stored as data, never auto-fetched into a privileged context.
6. **No script execution.** Metadata is treated strictly as inert data. Nothing in it is ever evaluated, templated into HTML unescaped, or used to drive control flow. Images are referenced by validated URL only.

Resolved+validated metadata is written to the `FlapToken` metadata columns with the resolution timestamp and the source CID/gateway, so a later re-validation (e.g. schema tightening) can re-run deterministically.

---

## 8. Summary of guarantees

- **Start narrow, read authoritatively.** Index the Portal only, from its deploy block **4180724**; validate against the Portal's own `getTokenV7`.
- **Events are candidates, not facts.** `LaunchedToDEX` triggers a four-stage validation (confirmations → Portal `status=DEX` → pool bytecode/token/WETH/factory → liquidity) before `VERIFIED_GRADUATED`.
- **Deterministic persistence.** Natural/composite keys + `(txHash, logIndex)` uniqueness make ingestion idempotent; a block-hash cursor plus confirmation depth make reorgs recoverable.
- **Untrusted metadata stays inert.** CID/MIME/size/schema/URL checks, no script execution.

This is the indexing design; it is not yet deployed and no real trades, funding, or graduations have been processed by it.
