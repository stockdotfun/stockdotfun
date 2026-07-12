# Uniswap V4 on Robinhood Chain — Verification (Part 1)

RPC `https://rpc.mainnet.chain.robinhood.com`, chain 4663. All addresses verified on-chain.

## Canonical addresses
| Contract | Address |
|---|---|
| poolManager | `0x8366a39CC670B4001A1121B8F6A443A643e40951` |
| positionManager | `0x58daec3116aae6D93017bAAea7749052E8a04fA7` |
| positionDescriptor | `0x9639443158E8C5efa35Bd45287bf2EFfd3D8dC06` |
| v4Quoter | `0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94` |
| stateView | `0xF3334192D15450CdD385c8B70e03f9A6bD9E673b` |
| universalRouter | `0x8876789976dEcBfCbBbe364623C63652db8C0904` |
| permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| weth | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| usdg | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |

## Checks
| Check | Result | Detail |
|---|---|---|
| chain id == 4663 | PASS | `got 4663` |
| poolManager has bytecode | PASS | `0x8366a39CC670B4001A1121B8F6A443A643e40951 (48020 chars)` |
| positionManager has bytecode | PASS | `0x58daec3116aae6D93017bAAea7749052E8a04fA7 (47756 chars)` |
| positionDescriptor has bytecode | PASS | `0x9639443158E8C5efa35Bd45287bf2EFfd3D8dC06 (1506 chars)` |
| v4Quoter has bytecode | PASS | `0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94 (12238 chars)` |
| stateView has bytecode | PASS | `0xF3334192D15450CdD385c8B70e03f9A6bD9E673b (7064 chars)` |
| universalRouter has bytecode | PASS | `0x8876789976dEcBfCbBbe364623C63652db8C0904 (49094 chars)` |
| permit2 has bytecode | PASS | `0x000000000022D473030F116dDEE9F6B43aC78BA3 (18306 chars)` |
| weth has bytecode | PASS | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73 (4406 chars)` |
| usdg has bytecode | PASS | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168 (342 chars)` |
| PositionManager.poolManager() == PoolManager | PASS | `0x8366a39CC670B4001A1121B8F6A443A643e40951` |
| PositionManager.permit2() == Permit2 | PASS | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| StateView.poolManager() == PoolManager | PASS | `0x8366a39CC670B4001A1121B8F6A443A643e40951` |
| V4Quoter.poolManager() == PoolManager | PASS | `0x8366a39CC670B4001A1121B8F6A443A643e40951` |
| WETH is WETH/18dp | PASS | `WETH/18` |
| USDG symbol | PASS | `USDG` |
| PoolManager.owner() nonzero | PASS | `0x2BAD8182C09F50c8318d769245beA52C32Be46CD` |

## RESULT: ALL PASS
