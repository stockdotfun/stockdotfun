# StockDotFun V2 Conversion Keeper

Automates converting each pool's pending holder+creator WETH into the paired
stock token via `StockRewardTreasury.convertPending`. Runs a live `V4Quoter`
quote and sets `minStockOut = quote − route.maxSlippageBps` (anti-sandwich), caps
the size at `route.maxWethPerConversion`, and skips PAUSED / LOW_LIQUIDITY pools.

## Security
The keeper key is **low-privilege**. `convertPending` only lets it trigger a
bounded, on-chain-constrained conversion for an already-registered pool — it
cannot move funds, choose the token/recipient/route/calldata, or change config.
Use a **dedicated keeper key**, not the owner key, and fund it only with gas.
(The current keeper is `0xCBC88Ba9…`; rotate to a separate address via
`treasury.setKeeper(newKeeper, true)` + `setKeeper(0xCBC88Ba9…, false)`.)

## Run locally
```bash
export RHC_RPC_URL=https://rpc.mainnet.chain.robinhood.com
export KEEPER_PRIVATE_KEY=0x<dedicated keeper key, gas-funded>
node scripts/keeper.mjs           # single pass
node scripts/keeper.mjs --loop    # every KEEPER_INTERVAL_S (default 300s)
```
Tunables: `KEEPER_MIN_WEI` (skip pools below this pending, default 0.01 WETH),
`KEEPER_INTERVAL_S`.

## Schedule options
- **GitHub Actions** (included): `.github/workflows/keeper.yml` runs every 15 min.
  Set repo secret `KEEPER_PRIVATE_KEY` (and optionally `RHC_RPC_URL`).
- **systemd timer / cron**: run `node scripts/keeper.mjs` on an interval.
- **Railway/Render cron** or a long-lived `--loop` process next to the indexer.

Conversions are asynchronous and batched by design, so a 15-minute cadence is
fine; rewards surface as "pending conversion" in the UI until a pass settles.
