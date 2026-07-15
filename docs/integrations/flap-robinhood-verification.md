# Flap × Robinhood Chain — Contract Verification Report

**Status: ✅ VERIFIED** (Phase 2 gate cleared)
**Date:** 2026-07-15
**Verifier:** `scripts/verify-flap-robinhood.ts` (re-runnable; exits non-zero on any failure)
**Machine config:** `config/flap.robinhood.json`

Source-of-truth priority followed: **on-chain state > verified Flap contracts > official Flap docs (docs.flap.sh)**. No address was taken from a social post; every address below was confirmed on-chain on the Robinhood Chain Blockscout instance and RPC.

---

## 1. Verified contracts

| Contract | Address | Notes |
|---|---|---|
| **Flap Portal (proxy)** | `0x26605f322f7fF986f381bB9A6e3f5DAb0bEaEb09` | `TransparentUpgradeableProxy`, version **v5.14.16** |
| Portal implementation | `0xd9C9981D784A3765D8264D6104650B901C4e36b1` | logic named `Portal` (EIP-1967 slot confirmed) |
| Proxy admin | `0x21f7f9B33dFD0dBc3a94C0EFA79F1546a1391FF5` | upgrade authority (trust assumption — see risks) |
| Tax Token Helper | `0xb10bD2672aE63735d677164A54B573a016f0203C` | for tax-token inspection |
| VaultPortal | `0xe9F7AB7DE8FB8756acbB6a1cd13316a43308197B` | |
| Standard token impl | `0x88882688a067FE97E11C2185b996286e53132222` | |
| Tax token V3 impl | `0x7777C8743C88B3aff3cf262135beF2c8b2e83333` | |

**Bytecode hashes** (keccak256 of deployed code):
- Portal proxy: `0xcecb292d9c022858199c9348abf0d5836f9ea4dab5cf03710e1dcf41fd9a4c35`
- Portal impl: `0x85facd83c203c88ea8f37c4f00c328f983e90c5045b06ec20ef18639c818186b`

**Deployment:** block **4180724**, tx `0x66ab432afa53aca015e57d94b4c0057d02e5a02600343dff6e66e6ea1281cdbc` (2026-07-08), deployer `0x3bfC05a8b9e48FdFd6A443657caC5D983B664a05`.

**ABI source:** Blockscout verified contract page for the Portal (`.../address/0x26605f…Eb09?tab=contract`).

---

## 2. Verification checks performed (all PASS)

| Check | Result |
|---|---|
| Chain id == 4663 | ✅ `4663` |
| Portal has deployed bytecode | ✅ 2,840 bytes |
| EIP-1967 implementation slot == documented impl | ✅ `0xd9C998…36b1` |
| `TokenCreated` topic0 matches signature | ✅ `0x504e7f36…9603` |
| `LaunchedToDEX` topic0 matches signature | ✅ `0x6e4f4763…ff7d` |
| `getTokenV7(WOBL)` status == DEX(4) | ✅ |
| `getTokenV7(WOBL).pool` == on-chain pool | ✅ `0x4AB8Abf…1733` |
| Historical `LaunchedToDEX` logs exist | ✅ **92 graduations** |
| Graduated pool pairs token + WETH | ✅ |
| Graduated pool factory == approved V2 fork | ✅ `0x8bcEaA40…937f` |

Two graduated tokens were fully proven end-to-end: **WOBL** (`0x76F8…7777`, pool `0x4AB8…1733`, 1.17 ETH liq) and **SERVO** (`0x4694…7777`, pool `0x0205…C2D0`, 5.85 ETH liq).

---

## 3. Read interface

- There is **no separate Portal Lens address** on RHC. The `getToken*` read methods are exposed **directly on the Portal**.
- Flap docs say `getTokenV8Safe` is **BNB-only**; on RHC use **`getTokenV7(address)`** → `TokenStateV7`.
- `TokenStatus` enum: `Invalid=0, Tradable=1 (bonding curve), InDuel=2 (obsolete), Killed=3 (obsolete), DEX=4 (graduated), Staged=5`.
- Full struct + selectors in `lib/integrations/flap/types.ts` and `portal.ts`.

## 4. Trading & migration

- **Bonding-curve trades** go through the Portal (`quoteExactInput` / `swapExactInput`).
- **After graduation** (`LaunchedToDEX`), trades must execute against the migrated DEX pool — **NOT** the Portal curve.
- On Robinhood Chain, Flap migrates to a **Uniswap V2-fork pair** (factory `0x8bcEaA40…937f`, router `0x89e5db8b…9eba`), **native-ETH quote** (`quoteToken = address(0)`, paired with WETH `0x0Bd7…AD73`), graduation depth **~5 ETH** (`CURVE_RH_TOSHI_5ETH`), `V2_MIGRATOR`.
- General Flap logic elsewhere prefers V3 with V2 fallback and restricts tax tokens to V2; **on RHC the observed graduations are all V2-fork** (WOBL/SERVO dexId=0).

## 5. Events indexed (topic0s)

- `TokenCreated(uint256 ts, address creator, uint256 nonce, address token, string name, string symbol, string meta)` — `meta` is the IPFS CID. topic0 `0x504e7f36…9603`.
- `LaunchedToDEX(address token, address pool, uint256 tokenAmount, uint256 quoteAmount)` — **primary graduation event**, params non-indexed. topic0 `0x6e4f4763…ff7d`.

## 6. Live stats (2026-07-15)

- Flap tokens created on RHC: **≥ 1,000** (Blockscout page cap; actual total higher).
- Graduated to DEX: **92**.

## 7. Known gaps / caveats

- Chain-id integer `4663` is not written literally in Flap docs (confirmed externally + by the Portal being live on the 4663 explorer).
- `DEXId` / `V3LPFeeProfile` enum integers are undocumented (observed `dexId=0` for V2 graduates).
- Event indexed-parameter layout is confirmed only where checked on-chain (`LaunchedToDEX` non-indexed); confirm `TokenCreated` topics before topic filtering.
- **No verified on-chain VRF/randomness provider found on RHC** — the reward campaign must use commit-reveal or remain paused (see `flap-reward-system.md`).
- The proxy is **upgradeable** by the proxy admin — a standing trust assumption; the integration must re-verify the implementation on a schedule and pause on unexpected upgrades.

## 8. Gate outcome

Verification **succeeded** → `FLAP_ROBINHOOD_PORTAL_ADDRESS` etc. can be set. The integration nonetheless ships **disabled** (`FLAP_INTEGRATION_ENABLED=false`) until the downstream phases (indexer backfill, gateway/reward deployment, funded inventory, randomness) are completed and separately verified.
