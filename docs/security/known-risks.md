# StockDotFun — Known Risks

These are accepted / residual risks known at the time of the internal review.
They are **not** resolved by the code and must be understood before mainnet.

## 1. No external audit (BLOCKER)
The contracts have passed an internal review and 32 automated tests (unit +
hardening + fuzz/invariant), but **no independent audit**. Meaningful value must
not be handled until an external audit is complete.

## 2. Owner centralization
Until ownership is a multisig + timelock, the owner key can pause the platform
and configure new launches. It cannot take user funds or accrued rewards
(see `admin-powers.md`), but key compromise is still material.

## 3. Shallow-curve slippage & MEV
The recommended curve is intentionally shallow (strong early-buyer upside), so
large buys incur high slippage and are sandwich-sensitive. Mandatory `minOut`
and a frontend default slippage bound each user's loss; Robinhood Chain's L2
sequencer (FCFS, no public mempool auction) reduces classic sandwiching but does
not eliminate sequencer-level ordering risk. Large orders should be split.

## 4. Robinhood stock tokens are upgradeable proxies
The verified stock/ETF tokens are ~280-byte proxy contracts controlled by the
issuer. Their behaviour can change via upgrade, and the issuer can freeze/seize
per their own terms. StockDotFun composes with them but does not control them.
They provide economic exposure only — **not** shares, ownership, or dividends.

## 5. Reward-token liquidity
Several verified assets (BABA, CRCL, QQQ, SGOV, SLV, USO) have thin holder bases
on Robinhood Chain and are seeded **disabled**. Routing holder fees into thin
assets could incur high slippage — mitigated by launching with routing disabled
(fees accrue in WETH) until a verified router + liquidity exist.

## 6. Router not yet configured
No verified DEX router is wired at launch. Holder fees accrue in WETH until an
audited `RouterAdapter` is deployed and set. The frontend shows
"Reward routing not configured yet" in this state.

## 7. Graduation / migration not implemented
The pool emits `Graduated` at the target but does not yet migrate liquidity to a
DEX. Post-graduation behaviour (36% of supply reserved) is a **design TODO** —
tokens keep trading on the curve until migration exists.

## 8. Metadata storage not connected
Token images/metadata use a local-preview flow; a permanent storage backend
(IPFS/Arweave/S3/R2) is not wired. `metadataURI` is currently caller-supplied.

## 9. Decimal assumptions
The curve math assumes an 18-decimal quote asset (WETH is 18 — verified). USDG
is 6 decimals; it is **not** used as the quote asset. Do not repoint the quote
asset to a non-18-decimal token without re-review.

## 10. Fixed reference ETH price in economics
`docs/economics` uses ETH=$1,796 (verification-time) for FDV figures only. It
does not affect contract behaviour.
