# Robinhood Chain Mainnet — Token Address Verification

**Verified:** 2026-07-10 · **Verifier:** internal engineering (automated `cast` + Blockscout API + official docs cross-check)

## Method

Every address below passed **all** of the following, per the verification requirement:

1. **Official docs cross-check** — fetched `https://docs.robinhood.com/chain/contracts/` and matched each address 1:1.
2. **Blockscout existence** — `GET https://robinhoodchain.blockscout.com/api/v2/tokens/{address}` returned HTTP 200 with token metadata and non-zero holder counts.
3. **Bytecode exists** — `cast code <addr>` non-empty on mainnet RPC.
4. **ERC20 metadata reads** — `name()`, `symbol()`, `decimals()`, `totalSupply()` all succeed via `https://rpc.mainnet.chain.robinhood.com`.

## Network (verified live)

| Item | Documented | Verified |
| --- | --- | --- |
| Mainnet chain ID | 4663 | ✅ `cast chain-id` → 4663 |
| Testnet chain ID | 46630 | ✅ `cast chain-id` → 46630 |
| Mainnet RPC | `https://rpc.mainnet.chain.robinhood.com` | ✅ live, block 6,116,529 at verification |
| Testnet RPC | `https://rpc.testnet.chain.robinhood.com` | ✅ live |
| Mainnet explorer | `https://robinhoodchain.blockscout.com` | ✅ live (API v2) |
| Testnet explorer | `https://explorer.testnet.chain.robinhood.com` | per docs (not exercised) |
| Alchemy RPC | `https://robinhood-mainnet.g.alchemy.com/v2/{KEY}` | per docs (needs API key) |
| Native currency | ETH (Arbitrum L2 on Ethereum) | ✅ per docs/connecting |

## Base assets

| Symbol | Address | Code | name() | decimals | Blockscout holders |
| --- | --- | --- | --- | --- | --- |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | ✅ | WETH | 18 | 53,569 ✅ |
| USDG | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | ✅ | Global Dollar | 6 | 8,770 ✅ |

## Stock tokens (all `18` decimals, all names follow "X • Robinhood Token")

| Symbol | Address | on-chain symbol() | Blockscout |
| --- | --- | --- | --- |
| AAPL | `0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9` | AAPL | ✅ 5,210 holders |
| AMD | `0x86923f96303D656E4aa86D9d42D1e57ad2023fdC` | AMD | ✅ |
| AMZN | `0x12f190a9F9d7D37a250758b26824B97CE941bF54` | AMZN | ✅ |
| BABA | `0xad25Ac6C84D497db898fa1E8387bf6Af3532a1c4` | BABA | ✅ (13 holders — low) |
| BE | `0x822CC93fFD030293E9842c30BBD678F530701867` | BE | ✅ |
| COIN | `0x6330D8C3178a418788dF01a47479c0ce7CCF450b` | COIN | ✅ |
| CRCL | `0xdF0992E440dD0be65BD8439b609d6D4366bf1CB5` | CRCL | ✅ (106 holders — low) |
| CRWV | `0x5f10A1C971B69e47e059e1dC91901B59b3fB49C3` | CRWV | ✅ |
| GOOGL | `0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3` | GOOGL | ✅ 4,574 holders |
| INTC | `0xc72b96e0E48ecd4DC75E1e45396e26300BC39681` | INTC | ✅ |
| META | `0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35` | META | ✅ |
| MSFT | `0xe93237C50D904957Cf27E7B1133b510C669c2e74` | MSFT | ✅ |
| MU | `0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD` | MU | ✅ |
| NVDA | `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC` | NVDA | ✅ 5,421 holders |
| ORCL | `0xb0992820E760d836549ba69BC7598b4af75dEE03` | ORCL | ✅ |
| PLTR | `0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A` | PLTR | ✅ |
| SNDK | `0xB90A19fF0Af67f7779afF50A882A9CfF42446400` | SNDK | ✅ |
| SPCX | `0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa` | SPCX | ✅ 5,323 holders |
| TSLA | `0x322F0929c4625eD5bAd873c95208D54E1c003b2d` | TSLA | ✅ 2,803 holders |
| USAR | `0xd917B029C761D264c6A312BBbcDA868658eF86a6` | USAR | ✅ |

## ETF tokens (all `18` decimals)

| Symbol (docs) | Address | on-chain symbol() | Blockscout |
| --- | --- | --- | --- |
| QQQ | `0xD5f3879160bc7c32ebb4dC785F8a4F505888de68` | QQQ | ✅ (82 holders — low) |
| SGOV | `0x92FD66527192E3e61d4DDd13322Aa222DE86F9B5` | SGOV | ✅ (43 holders — low) |
| SLV | `0x411eFb0E7f985935DAec3D4C3ebaEa0d0AD7D89f` | SLV | ✅ (68 holders — low) |
| SPY | `0x117cc2133c37B721F49dE2A7a74833232B3B4C0C` | SPY | ✅ |
| CUSO | `0xa30FA36Db767ad9eD3f7a60fC79526fB4d56D344` | **USO** ⚠️ | ✅ (38 holders — low) |

## Findings

1. **All 27/27 addresses verified** — bytecode present, ERC20 reads succeed, Blockscout pages exist, docs match.
2. **Discrepancy — CUSO:** the docs page lists the symbol as `CUSO`, but the on-chain `symbol()` is `USO` (name "United States Oil Fund • Robinhood Token"). The registry records both (`symbol: "USO"`, `docsSymbol: "CUSO"`). UI displays the on-chain symbol.
3. **Token contracts are proxies** (~280-byte runtime code) — expected for Robinhood-issued assets; they are upgradeable by the issuer. This is recorded as a platform risk (see `docs/security/known-risks.md`).
4. **Low-liquidity assets:** BABA (13 holders), CUSO/USO (38), SGOV (43), SLV (68), QQQ (82), CRCL (106) have thin holder bases. These are seeded **enabled=false** by default in the registry until liquidity justifies enabling them.
5. WETH is canonical and heavily used (53k+ holders) — safe as the quote/reward asset.

## Raw data

- `raw-results.txt` — pipe-delimited cast read results (label|address|codesize|name|symbol|decimals|totalSupply)
- `blockscout-results.txt` — pipe-delimited Blockscout checks (label|address|status|symbol|holders)
