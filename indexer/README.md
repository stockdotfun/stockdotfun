# StockDotFun V2 Indexer (Ponder)

Production indexer for the StockDotFun V2 contracts on Robinhood Chain (4663).
Indexes launches, trades, holders, stock-reward conversions, claims, and
graduations; serves a typed REST API that the frontend consumes.

> **Status:** code complete, **not yet run** in this repo. It requires
> `npm install`, a Postgres database, and the **deployed V2 addresses** (V2 has
> not been deployed to mainnet yet). It is not part of the frontend build.

## Setup
```bash
cd indexer
npm install
cp .env.example .env.local   # fill FACTORY/TREASURY/CREATOR_VAULT + DATABASE_URL + FACTORY_START_BLOCK
npm run codegen              # generate ponder:* virtual modules
npm run typecheck            # tsc --noEmit
npm run dev                  # local dev with hot reload + GraphQL playground
# production:
npm run start
```

## Hosting
The indexer is a **long-running Node process** — it needs a place to run
(Railway / Render / Fly / a small VPS), not just a database.

- **Database:** Supabase, Railway Postgres, Neon, or any Postgres. With Supabase,
  use the **direct connection (port 5432)** or session pooler — the transaction
  pooler (6543) breaks Ponder's advisory locks + prepared statements.
- **Process:** Railway/Render can run `ponder start` and provision Postgres in
  one place (simplest). Or Supabase DB + a small Node host for the process.
- **Do NOT** use serverless/Edge Functions for the indexer — it must run
  continuously and hold sync state.

## What it indexes
- `Factory.TokenCreated` → `tokens`, `pools` (dynamic per-launch discovery via Ponder `factory()`)
- `Pool.Buy` / `Pool.Sell` → `trades`, running volume + `realQuote` (curve progress)
- `Pool.GraduationReady/Completed/Failed` → `graduations` + token lifecycle
- `Treasury.Converted` / `StockConversionFailed` → `conversions`
- `HolderVault.RewardClaimed` / `CreatorVault.RewardClaimed` → `claims`
- `MemeToken.Transfer` → `holders`, holder counts

## API (consumed by the frontend via `NEXT_PUBLIC_INDEXER_URL`)
| Route | Returns |
|---|---|
| `GET /health` | liveness |
| `GET /tokens?search=&stock=&sort=` | explore list |
| `GET /tokens/:address` | token detail (lifecycle, curveProgress, counts) |
| `GET /tokens/:address/trades` | recent trades |
| `GET /creators/:creator/tokens` | creator dashboard |
| `GET /metrics` | protocol totals |
| `GET /graphql` | Ponder's auto GraphQL |

USD price fields are intentionally omitted until a price oracle is wired — the
API never fabricates prices.

## Health endpoints
`/health` plus Ponder's built-in `/ready` and status; compare indexer block vs
chain block to monitor lag.

## Point the frontend at it
Set `NEXT_PUBLIC_INDEXER_URL=https://<indexer-host>` in the web app; the
`externalClient` (lib/indexer/apiClient.ts) then serves Explore/Portfolio/Creator.
