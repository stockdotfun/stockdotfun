# StockDotFun — Deployment Checklist

Read this fully before setting `DEPLOY_CHECKLIST_ACK`. The deploy script refuses
to broadcast without it.

## Pre-flight (must ALL be true)
- [ ] **External audit complete** and findings resolved. (BLOCKER — not yet done.)
- [ ] Testnet deploy exercised end-to-end (create → buy → sell → claim).
- [ ] `forge test` green; `slither` triaged.
- [ ] Deployer key is a **fresh, secure key** (hardware wallet / keystore) — NOT
      any key ever pasted into a chat or committed.
- [ ] Deployer funded with enough ETH for gas on the target chain.
- [ ] `PROTOCOL_TREASURY` set to the intended treasury (multisig recommended).
- [ ] `NEW_OWNER` set to the governance multisig (for two-step handoff).
- [ ] Curve params reviewed (`docs/economics/default-parameters.md`).
- [ ] Router policy decided: launch with `NoopRouterAdapter` (fees accrue in
      WETH) unless a verified router is audited and ready.

## Environment
```bash
export RHC_RPC_URL=https://rpc.mainnet.chain.robinhood.com   # or testnet
export DEPLOYER_PRIVATE_KEY=0x...        # secure key, never committed
export PROTOCOL_TREASURY=0x...           # multisig
export NEW_OWNER=0x...                   # governance multisig (optional)
```

## 1. Dry run (no broadcast — validates chain, balance, prints plan)
```bash
cd contracts
forge script script/DeployRobinhood.s.sol --rpc-url $RHC_RPC_URL
```
Confirm: correct network, correct deployer, non-zero balance, expected params.

## 2. Broadcast (only after dry run looks correct)
```bash
export DEPLOY_CHECKLIST_ACK=I_HAVE_READ_DEPLOYMENT_CHECKLIST
forge script script/DeployRobinhood.s.sol --rpc-url $RHC_RPC_URL --broadcast
```
Deployment order (automated by the script):
1. `StockAssetRegistry` → seed 25 assets (standard enabled, thin disabled)
2. `NoopRouterAdapter`
3. `StockDotFunFactory` (deploys `CreatorRewardVault` internally)
4. Optional two-step ownership transfer to `NEW_OWNER`
5. Post-deploy read-back assertions

## 3. Post-deploy
- [ ] Copy printed `NEXT_PUBLIC_*` addresses into the production frontend env.
- [ ] From the multisig, `acceptOwnership()` on factory + registry.
- [ ] Verify contracts on Blockscout.
- [ ] Set `NEXT_PUBLIC_DEMO_MODE=false` (hard-blocked on mainnet anyway).
- [ ] Smoke-test one real launch with a tiny buy/sell/claim.
- [ ] Confirm frontend shows "Mainnet connected / Contracts configured".

## Rollback / emergency
- `factory.setTradingPaused(true)` — halt all trading + new launches.
- `factory.setClaimsPaused(true)` — halt reward claims.
- These are the only emergency levers; there is no fund-rescue (by design).
