# StockDotFun — Audit Readiness Checklist

For handing the contracts to an external auditor.

## Code
- [x] Contracts compile (solc 0.8.26, via-IR, optimizer 200)
- [x] `forge fmt` clean
- [x] No mock contracts in `src/` (mocks live only in `test/` and `script/LocalE2E.s.sol`)
- [x] Fixed supply token, no arbitrary mint
- [x] ReentrancyGuard + SafeERC20 throughout
- [x] Ownable2Step, no reward-vault admin withdrawal
- [x] Full NatSpec on public/external functions

## Tests
- [x] 32 tests passing (unit + hardening + invariant)
- [x] Fuzz/invariant driver (vault solvency, reserve backing)
- [ ] `forge coverage` ≥ 90% line/branch (needs `--ir-minimum`; not yet captured)
- [ ] Differential/echidna campaign (optional, recommended)

## Static analysis
- [ ] `slither` run + triaged (NOT installed in this env)
- [ ] `mythril` run (optional)
- [ ] `solhint` run (optional)

## Docs for auditors
- [x] `docs/security/internal-security-review.md`
- [x] `docs/security/threat-model.md`
- [x] `docs/security/known-risks.md`
- [x] `docs/security/admin-powers.md`
- [x] `docs/economics/*` (curve model + params)
- [x] `docs/mainnet-verification/token-address-verification.md`

## Deployment
- [x] Chain-gated deploy script (mainnet/testnet only)
- [x] Dry-run mode + acknowledgement-gated broadcast
- [x] Post-deploy read-back verification
- [ ] Testnet deployment exercised end-to-end (pending testnet run)
- [ ] Owner = multisig + timelock (operational, pending)

## Open design items to disclose to auditors
- Graduation/migration to a DEX is **not implemented** (pool emits `Graduated`
  only). 36% supply reserved for it.
- Router adapter is `Noop` at launch — holder fees accrue in WETH.
- Metadata storage backend not connected (`metadataURI` caller-supplied).
