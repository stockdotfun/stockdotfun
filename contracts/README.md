# StockDotFun Contracts

Foundry project containing the onchain foundation for the StockDotFun
launchpad. **Unaudited — do not deploy to mainnet without an independent
audit.**

## Architecture

| Contract | Role |
| --- | --- |
| `StockDotFunFactory` | Deploys meme tokens; wires pool + vaults; holds fee/curve config (owner-gated, fee-capped) |
| `MemeToken` | Fixed-supply ERC20; checkpoints the reward vault on transfers; **no transfer tax** |
| `StockAssetRegistry` | Admin-controlled list of supported stock-token assets (enable/disable, price feeds) |
| `BondingCurvePool` | Per-token constant-product curve (virtual reserves); buy/sell in the quote asset; applies the fee split |
| `RewardVault` | Per-token holder rewards via accumulated-reward-per-share; holds stock token and/or quote |
| `CreatorRewardVault` | Global creator reward ledger; claim per asset |
| `IRouterAdapter` | Pluggable quote→stock conversion; **fail-safe**: no adapter or failed swap ⇒ fees accrue in quote |

Fee flow per trade: `fee = trade × totalFeeBps`, split holder/creator/protocol
(shares sum to 100%, total fee hard-capped at 10%). Holder share is converted
to the paired stock token when a router adapter is configured; otherwise it
accrues in the quote asset and can be converted later.

## Setup

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup   # if forge is missing
cd contracts
forge build
forge test -vv
```

Dependencies are vendored in `lib/` (OpenZeppelin v5.1.0, forge-std).

## Deploy (testnet only until audited)

```bash
export DEPLOYER_PRIVATE_KEY=0x...
export RHC_RPC_URL=https://...
export WETH_ADDRESS=0x...   # quote/reward asset (wrapped ETH)
export PROTOCOL_TREASURY=0x...
forge script script/Deploy.s.sol --rpc-url $RHC_RPC_URL --broadcast
```

Then:

1. `registry.addAsset(<stockToken>, "TSLA", <priceFeed>, "")` for each supported asset.
2. Copy printed addresses into the frontend `.env` (`NEXT_PUBLIC_STOCKDOTFUN_*`).
3. Configure a `RouterAdapter` implementation when Robinhood Chain routing infra is known: `factory.setRouterAdapter(...)`.

## Known TODOs before mainnet

- Independent security audit.
- Graduation/migration mechanics (pool emits `Graduated`; DEX migration not implemented).
- Real `RouterAdapter` implementation for an actual Robinhood Chain DEX.
- Pausable/emergency controls review.
- Decimal handling review for quote assets ≠ 6 decimals.
