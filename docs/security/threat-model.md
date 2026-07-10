# StockDotFun — Threat Model

## Assets at risk
- Pool reserves (WETH) backing sells.
- Holder reward vault balances (WETH and/or paired stock token).
- Creator reward vault balances.
- Protocol treasury inflows.
- User wallets interacting via the frontend.

## Actors
- **Trader** — buys/sells on the curve.
- **Creator** — launches a token, earns creator fees.
- **Holder** — holds a meme token, may claim stock-token rewards.
- **Owner** — protocol admin (should be a multisig).
- **Attacker** — arbitrary external account.
- **Malicious router** — a swap adapter that lies or steals.
- **Malicious ERC20** — a token that misbehaves on transfer.
- **Sequencer / MEV** — L2 ordering-based value extraction.

## Threats and mitigations

| # | Threat | Mitigation | Test |
| --- | --- | --- | --- |
| T1 | Reentrancy on buy/sell/claim | `ReentrancyGuard` on all; checks-effects-interactions; `SafeERC20` | invariant + unit |
| T2 | Buy drains more tokens than pool holds | `ExceedsCurveDepth` guard; rounding favours pool | `test_*`, invariant `PoolBacksReserve` |
| T3 | Sell underflows reserve accounting | rounding favours pool; guarded subtraction | `test_SellToken`, invariants |
| T4 | Over-claim of rewards | acc-per-share model; `accPaid` checkpointing; per-holder settle | `test_RepeatedClaim`, `test_NonHolderClaims`, invariant `VaultSolvent` |
| T5 | Admin drains reward vaults | **no** admin withdraw path exists | `admin-powers.md`, code review |
| T6 | Fee bypass / fees > cap | `MAX_FEE_BPS=1000`, share-sum check | `test_FeeCapEnforced`, `test_FeeSplitRouting` |
| T7 | Unsupported / zero-address stock asset | registry gate in factory; zero-address checks | `test_RejectUnsupported*`, `test_DisabledAsset*` |
| T8 | Malicious router steals quote / fakes rewards | balance-delta accounting; fail-closed (`RouterMisbehaved`); Noop fallback | `test_LyingRouter`, `test_RevertingRouter`, `test_NoopRouter` |
| T9 | Malicious ERC20 (false-return transfer) | `SafeERC20` turns silent failure into revert | `test_FalseReturnToken` |
| T10 | Slippage-blind trades sandwiched | mandatory non-zero `minOut`; frontend default slippage | `test_ZeroMinOutRejected` |
| T11 | Invalid curve params (zero price / overflow) | `InvalidCurveParams` bounds | `test_InvalidCurveParams` |
| T12 | Double pool initialization | `PoolAlreadySet` on vault init; pools created only by factory | code review |
| T13 | Unauthorized admin action | Ownable2Step; `onlyOwner`; `OnlyPool`/`OnlyFactory`/`OnlyMemeToken` | `test_UnauthorizedAdmin`, `test_OnlyPoolCanNotify` |
| T14 | Owner-key compromise | multisig + timelock (operational, **pending**) | — |
| T15 | Sequencer / MEV sandwich on shallow curve | mandatory minOut; L2 FCFS ordering reduces (not eliminates) risk | economics report — **residual risk** |
| T16 | Proxy stock tokens upgraded by issuer | out of our control; documented risk | `known-risks.md` |

## Out of scope for the contracts (front-end / operational)
- Wallet phishing, RPC MITM, DNS — standard web hygiene.
- Storage backend for token metadata (not yet connected).
- Front-running of `createToken` names — cosmetic.
