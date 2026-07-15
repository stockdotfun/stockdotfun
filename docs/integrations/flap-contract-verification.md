# Flap Contract Verification

How the Flap contracts backing the StockDotFun × Flap integration were resolved and
verified on-chain. This document records the resolution method, the evidence checked, and
the exact verified addresses. It does **not** describe anything deployed by StockDotFun —
the integration contracts are built and fork/unit tested only, and ship disabled
(`FLAP_INTEGRATION_ENABLED=false`).

## Chain

- **Network:** Robinhood Chain (RHC)
- **Chain ID:** `4663`

All addresses below live on chain `4663`. The verification script
[`scripts/verify-flap-robinhood.ts`](../../scripts/verify-flap-robinhood.ts) is chain-gated
to `4663` and passes **10/10** checks against config
[`config/flap.robinhood.json`](../../config/flap.robinhood.json).

## Resolution & verification method

1. **Portal identity (EIP-1967).** The Flap Portal is a `TransparentUpgradeableProxy`. We
   read the EIP-1967 implementation slot
   (`0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`) and the admin slot
   (`0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103`) to confirm the
   proxy points at the Portal implementation and is owned by the expected proxy admin.
2. **Bytecode.** Proxy, implementation, and pair/factory/router addresses were confirmed to
   have non-empty bytecode at the resolved addresses on chain `4663`.
3. **Implementation version.** The implementation self-reports version `v5.14.16`.
4. **Read path.** Token state is read with `getTokenV7(address)` **on the Portal itself** —
   there is no separate Lens contract on RHC, and `getTokenV8Safe` is BNB-only.
5. **Event topics.** Graduation and creation events were matched by `topic0` (see below) and
   decoded against the Portal ABI.
6. **Graduate spot-checks.** Two graduated tokens were resolved end-to-end (Portal token
   status `DEX` + a live Uniswap V2-fork pair) to confirm the migration path.

## Verified addresses (chain 4663)

| Component | Address | Notes |
|---|---|---|
| Flap Portal (proxy) | `0x26605f322f7fF986f381bB9A6e3f5DAb0bEaEb09` | `TransparentUpgradeableProxy`, deploy block `4180724` |
| Portal implementation | `0xd9C9981D784A3765D8264D6104650B901C4e36b1` | version `v5.14.16` |
| Proxy admin | `0x21f7f9B33dFD0dBc3a94C0EFA79F1546a1391FF5` | can upgrade the Portal |
| V2 factory | `0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f` | Uniswap V2-fork |
| V2 router | `0x89e5DB8B5aA49aA85AC63f691524311AEB649eba` | Uniswap V2-fork |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | native-ETH quote pairs against this |

## Reading token state: `getTokenV7`

On RHC, call `getTokenV7(address)` on the Portal proxy. The returned `TokenStatus` enum:

| Value | Status | Meaning |
|---|---|---|
| 0 | `Invalid` | not a Flap token |
| 1 | `Tradable` | on the bonding curve |
| 2 | `InDuel` | obsolete |
| 3 | `Killed` | obsolete |
| 4 | `DEX` | graduated to a Uniswap V2-fork pair |
| 5 | `Staged` | staged, pre-tradable |

## Event topics

- **`TokenCreated(uint256 ts, address creator, uint256 nonce, address token, string name, string symbol, string meta)`**
  - `meta` is the IPFS CID.
  - `topic0` = `0x504e7f360b2e5fe33cbaaae4c593bc55305328341bf79009e43e0e3b7f699603`
- **`LaunchedToDEX(address token, address pool, uint256 tokenAmount, uint256 quoteAmount)`**
  - Primary graduation event; all params are **non-indexed**.
  - `topic0` = `0x6e4f47630b8745b8cacbd44f42a8a33e7eea7cc08ef22fc7630f4f385784ff7d`

## Graduation path

On RHC, Flap graduates from its bonding curve to a **Uniswap V2-fork pair**:

- **Quote asset:** native ETH (`address(0)`), paired against WETH
  `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`.
- **Curve / depth:** `CURVE_RH_TOSHI_5ETH` — approximately 5 ETH graduation depth.
- **Migrator:** `migratorType = V2_MIGRATOR`.
- **Tax tokens** are supported.

## Stats & verified graduates

- **≥ 1000** Flap tokens created; **92** graduated.

| Token | Token address | Pool |
|---|---|---|
| WOBL | `0x76F80333B1d0abF3ff1636cdFb4efcE0FE747777` | `0x4AB8Abf127043779968e3Ef3B8c9A393DA4b1733` |
| SERVO | `0x46941bE352545305a299975CDC54D9Fdf7Ce7777` | `0x02051a877477E810993c24aC295704065721C2D0` |

## Trust assumptions (honest)

- The Portal is **upgradeable** by the proxy admin
  (`0x21f7f9B33dFD0dBc3a94C0EFA79F1546a1391FF5`); its behavior can change.
- Nothing in this document is deployed, funded, or operated by StockDotFun. The StockDotFun
  integration contracts are built and fork/unit tested only, are not deployed, and ship
  disabled (`FLAP_INTEGRATION_ENABLED=false`).

## References

- Verification script: [`scripts/verify-flap-robinhood.ts`](../../scripts/verify-flap-robinhood.ts) (10/10 pass)
- Config: [`config/flap.robinhood.json`](../../config/flap.robinhood.json)
- Full verification report: [`docs/integrations/flap-robinhood-verification.md`](./flap-robinhood-verification.md)
