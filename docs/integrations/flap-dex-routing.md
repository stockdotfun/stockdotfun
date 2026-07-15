# Flap DEX Routing

How StockDotFun routes trades for **graduated** Flap tokens on Robinhood Chain (RHC, chain 4663) — and why those trades go to the migrated Uniswap V2-fork pool, never the Portal bonding curve.

> Status: adapters are **built and fork/unit-tested, not deployed**. Nothing here is live, funded, or executing real trades. The integration ships **disabled** (`FLAP_INTEGRATION_ENABLED=false`).

---

## 1. Two venues, one lifecycle

A Flap token has two distinct trading venues over its life:

1. **Portal bonding curve** — while the token is on the curve, buys/sells clear against the Flap Portal
   (`0x26605f322f7fF986f381bB9A6e3f5DAb0bEaEb09`, TransparentUpgradeableProxy, impl v5.14.16).
   On RHC the curve uses a native-ETH quote (`address(0)`) with ~5 ETH graduation depth (`CURVE_RH_TOSHI_5ETH`).
2. **Migrated V2 pool** — once the curve fills, the Portal migrates liquidity out to a Uniswap V2-fork pair
   (`migratorType = V2_MIGRATOR`) and the curve is retired for that token.

The single source of truth for which venue is active is the Portal itself. Read it with `getTokenV7(address)`
**on the Portal** — there is no separate Lens on RHC, and `getTokenV8Safe` is BNB-only.

`TokenStatus` values returned by `getTokenV7`:

| Value | Status | Meaning for routing |
|------:|--------|---------------------|
| 0 | `Invalid` | Unknown token — do not route |
| 1 | `Tradable` | On the Portal curve |
| 2 | `InDuel` | Obsolete |
| 3 | `Killed` | Obsolete |
| 4 | `DEX` | **Graduated — route to the migrated V2 pool** |
| 5 | `Staged` | Created, not yet tradable |

Graduation is signalled on-chain by the Portal's primary graduation event:

```
LaunchedToDEX(address token, address pool, uint256 tokenAmount, uint256 quoteAmount)
topic0 0x6e4f47630b8745b8cacbd44f42a8a33e7eea7cc08ef22fc7630f4f385784ff7d
```

(params are non-indexed; the `pool` field is the migrated pair address to route against.)

Token creation is tracked via:

```
TokenCreated(uint256 ts, address creator, uint256 nonce, address token, string name, string symbol, string meta)
topic0 0x504e7f360b2e5fe33cbaaae4c593bc55305328341bf79009e43e0e3b7f699603
```

(`meta` is the IPFS CID.)

---

## 2. Why graduated trades go to the V2 pool, not the curve

Once `LaunchedToDEX` fires and `getTokenV7` reports `DEX (4)`, the bonding curve for that token is **retired**:
liquidity has been migrated out to the V2 pair, and the Portal no longer clears buys/sells on the curve. Any
attempt to trade a graduated token against the curve is against a drained/closed venue. Price discovery and
liquidity now live entirely in the V2 pool.

So routing is a hard branch on the on-chain status, not a heuristic:

- `Tradable (1)` → Portal curve (not covered by these adapters).
- `DEX (4)` → migrated Uniswap V2-fork pool, via the adapter layer below.
- anything else → do not route.

On RHC the migrated venue is a Uniswap V2-fork with:

- Factory `0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f`
- Router  `0x89e5DB8B5aA49aA85AC63f691524311AEB649eba`
- Native-ETH quote (`address(0)`), paired with WETH `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`
- Tax tokens supported

Verified graduates used in testing:

| Token | Address | Migrated pool |
|-------|---------|---------------|
| WOBL | `0x76F80333B1d0abF3ff1636cdFb4efcE0FE747777` | `0x4AB8Abf127043779968e3Ef3B8c9A393DA4b1733` |
| SERVO | `0x46941bE352545305a299975CDC54D9Fdf7Ce7777` | `0x02051a877477E810993c24aC295704065721C2D0` |

(At time of verification: ≥1000 Flap tokens created, 92 graduated.)

---

## 3. Adapter architecture

Routing is behind a small adapter layer so that each DEX family is isolated and individually allowlisted.

```
                         ┌──────────────────────────┐
  trade request  ──────► │   FlapDexAdapterRegistry  │
  (token, status DEX)    │  - resolves adapter        │
                         │  - enforces allowlist      │
                         └────────────┬──────────────┘
                                      │ IFlapDexAdapter
                                      ▼
                         ┌──────────────────────────┐
                         │      FlapV2DexAdapter      │
                         │  - Uniswap V2-fork router  │
                         │  - tax-token-safe swap     │
                         │  - delta verification      │
                         └────────────┬──────────────┘
                                      ▼
                          migrated V2 pool (WETH quote)
```

### `IFlapDexAdapter`

The common interface every DEX adapter implements. It abstracts "given a graduated token and a trade, execute
the swap against that token's migrated venue and report the realized amounts." The registry only ever talks to
adapters through this interface, so new DEX families can be added without touching call sites.

### `FlapV2DexAdapter`

The concrete adapter for the Uniswap V2-fork venue Flap graduates into on RHC. It:

- Uses the V2-fork router (`0x89e5…49eba`) and the WETH quote path.
- Performs **tax-token-safe swaps** (see §5).
- Performs **delta verification** on the actual token balance change (see §6).

### `FlapDexAdapterRegistry`

Maps a token / DEX family to its adapter and enforces the allowlist. A token is only routable if its resolved
venue is explicitly registered. This is the choke point that prevents routing to an unknown or unvetted pool.

---

## 4. Allowlisting

Routing is **allowlist-gated, not open**. The registry will only route a graduated token when its migrated
venue resolves to a registered, vetted adapter. This means:

- A token that has graduated to a **supported** DEX family (the RHC V2-fork) resolves to `FlapV2DexAdapter`
  and can be routed.
- A token that graduated to any venue **not** in the registry is treated as unsupported and is not routed
  (see §7).

Allowlisting is deliberate: it keeps StockDotFun from swapping against pools it has not verified, and it makes
adding a new DEX family an explicit, reviewable registration rather than an implicit fallback.

---

## 5. Tax-token-safe swaps

Flap supports **tax tokens** — tokens that take a fee on transfer, so the amount received by the recipient is
less than the amount sent. A naive swap that assumes `amountOut == quotedOut` will over-credit the user and can
revert or mis-account against a fee-on-transfer token.

`FlapV2DexAdapter` therefore does **not** trust the router's quoted output. It uses fee-on-transfer-aware swap
semantics and measures the **actual** balance delta received (§6), so tax tokens are handled correctly by
construction rather than assumed away.

---

## 6. Delta verification

Every routed swap is verified against the **realized** balance change, not the quoted amount:

1. Snapshot the recipient's token balance before the swap.
2. Execute the swap through the V2-fork router.
3. Snapshot the balance after and compute the delta.
4. Require the delta to satisfy the trade's minimum-out / slippage bound.

This closes the gap between quoted and realized amounts that tax tokens (§5), rounding, and pool state drift can
open. The delta is also what gets reported to downstream accounting, so credited amounts always reflect tokens
actually received.

On success, the trade is surfaced through the gateway:

```
StockDotFunExternalTradeGateway → ExternalTradeExecuted
  source = keccak256("FLAP")
```

---

## 7. Unsupported-DEX honesty

If a token has graduated (`DEX (4)`) but its migrated venue is **not** an allowlisted, adapter-backed DEX, the
system does not guess, does not fall back to the retired curve, and does not silently no-op. It reports the
honest state:

> **Graduated on Flap / DEX routing not yet supported**

This is intentional. Only the RHC Uniswap V2-fork family is adapter-backed today. Any other graduation target is
surfaced as unsupported rather than routed on hope. Adding support is an explicit new adapter + registry
entry, not a config toggle.

---

## 8. Trust assumptions (honest)

- The Flap **Portal is upgradeable** by its proxy admin (`0x21f7f9B33dFD0dBc3a94C0EFA79F1546a1391FF5`);
  `getTokenV7` results and graduation behavior depend on the deployed implementation.
- The adapters, registry, and gateway are **fork- and unit-tested only — not deployed** to RHC.
- No mainnet deploy, no funding, and no real trades have been done.
- The integration ships **disabled** (`FLAP_INTEGRATION_ENABLED=false`) and is deployed via the chain-gated
  (4663) script `contracts/script/DeployFlapIntegration.s.sol`.

---

## References

- Verification report: `docs/integrations/flap-robinhood-verification.md`
- Verification script: `scripts/verify-flap-robinhood.ts` (10/10 pass)
- Config: `config/flap.robinhood.json`
