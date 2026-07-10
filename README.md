# StockDotFun

A Robinhood Chain-native meme coin launchpad where creators pair meme coins
with supported tokenized stock assets. Trading fees route toward a holder
stock-token reward vault, creator rewards, and the protocol treasury.

> Create meme. Choose stock pair. Launch.

## Stack

- **Frontend**: Next.js (App Router) · TypeScript · Tailwind CSS v4 · Framer Motion · wagmi + viem · TanStack Query
- **Contracts**: Solidity 0.8.26 · Foundry · OpenZeppelin v5 (see [contracts/](contracts/README.md))
- **Theming**: full light/dark system via semantic CSS variables (persistent + system preference)

## Run locally

```bash
npm install
cp .env.example .env.local   # demo mode on by default
npm run dev                  # http://localhost:3000
```

Checks: `npm run lint` · `npx tsc --noEmit` · `npm run build`

Contracts (requires [Foundry](https://getfoundry.sh)):

```bash
cd contracts && forge build && forge test -vv
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Marketing landing |
| `/launch` | Launch intro |
| `/create` | 4-step create-coin wizard (real `createToken` call when configured) |
| `/explore` | Launchpad explore: search, filters, sort, cards/table |
| `/token/[address]` | Token detail: stats, chart, buy/sell panel, rewards |
| `/portfolio` | Holdings, holder/creator rewards, created coins, transactions |
| `/rewards` | Reward center explanation |
| `/creator` | Creator dashboard |
| `/admin` | Env-gated config foundation (`ADMIN_ENABLED=true` in prod) |
| `/docs/*` | How it works, supported assets, fees, contracts |
| `/risk` `/terms` `/privacy` | Legal |

## Configuration

All chain/contract values come from environment variables — see
[.env.example](.env.example). With nothing configured the app runs safely in
"not configured" mode (transactions disabled with clear messaging), and
`NEXT_PUBLIC_DEMO_MODE=true` shows clearly-labeled demo data. Demo data is
never mixed into live mode.

## Architecture notes

- `lib/config.ts` — env-derived flags (`isChainConfigured`, `areContractsConfigured`, `demoMode`)
- `lib/chains/robinhood.ts` — chain from env (no hardcoded IDs/RPCs)
- `lib/contracts/` — addresses + typed ABIs matching `contracts/src`
- `lib/indexer/` — data backend abstraction (demo / onchain / external)
- `lib/data/assets.ts` — supported-asset registry config (pre-deployment source of truth)
- `lib/storage/upload.ts` — image/metadata storage adapter (TODO: Pinata/Arweave/S3/R2)
- `hooks/` — `useCreateToken`, `useSupportedAssets`, `useLaunchConfig`, `useWalletNetwork`, `useExploreTokens`, `usePortfolio`, `useUploadTokenImage`

## Before mainnet

1. Verify Robinhood Chain ID / RPC / explorer and set env vars.
2. Audit + deploy contracts (`contracts/script/Deploy.s.sol`), register stock assets.
3. Connect a storage backend for token images/metadata.
4. Stand up an event indexer for explore/portfolio/trades data.
5. Configure a RouterAdapter for quote→stock conversion.
6. Legal review of terms/privacy/risk copy.

## Compliance

Stock-token assets may provide economic exposure but do not represent direct
ownership of underlying securities. Rewards depend on activity and protocol
configuration — never guaranteed. StockDotFun is independent and not
affiliated with Robinhood unless officially stated. Nothing here is financial
advice.
