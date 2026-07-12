# StockDotFun V2 — Go-Live Checklist

**The build is done and shipped.** V2 is deployed on Robinhood Chain (4663),
verified on Blockscout, routes seeded, frontend rewired, metadata pinning live,
keeper + indexer written and proven against the live chain, all on GitHub.

What remains is a handful of **credential pastes only you can do** (I don't have
these secrets, and they must not go through chat). Each is ~2 minutes. Do them
when you're awake — none of this is on fire; the protocol is already live.

---

## 1. Indexer → Supabase + a host  (~10 min)
Gives Explore / Portfolio / Creator real data.

1. Supabase → **Connect**. Prefer the **Session pooler** string (IPv4, works on
   any host) over Direct (IPv6-only unless you have the IPv4 add-on). Use **port
   5432** (session) — NOT 6543 (transaction pooler breaks Ponder).
   - **Percent-encode special characters in the password.** e.g. `@` → `%40`,
     `#` → `%23`, `:` → `%3A`. An un-encoded `@` silently breaks the URL
     (Postgres reads the wrong host). Never commit the real string anywhere.
2. Deploy the `indexer/` folder to **Render** or **Railway** (configs included):
   - **Render:** New → Blueprint → this repo → it reads `indexer/render.yaml`.
   - **Railway:** New → Deploy from repo → set root dir `indexer` → it reads `railway.json`.
3. In the host dashboard, set env var **`DATABASE_URL`** = the Supabase direct
   string. (The V2 addresses + start block are already in the config files.)
4. Deploy. Health check is `/ready`. Confirm `https://<host>/tokens` returns `[]`.

## 2. Frontend → point at the indexer  (~2 min)
In your web host (Vercel) env, set:
```
NEXT_PUBLIC_INDEXER_URL=https://<your-indexer-host>
```
Redeploy. Explore/Portfolio/Creator now show live data.

## 3. Keeper automation  (~3 min)
Converts pending fees into stock rewards on a schedule.
1. Create a **dedicated keeper wallet** (`cast wallet new`), fund it with a little
   gas, and make it the keeper:
   `cast send <TREASURY> "setKeeper(address,bool)" <keeperAddr> true` (from owner).
2. GitHub repo → **Settings → Secrets and variables → Actions** → add
   **`KEEPER_PRIVATE_KEY`** = the keeper key. The scheduled Action
   (`.github/workflows/keeper.yml`) then runs every 15 min.

## 4. Ownership → multisig  (DO WHEN RESTED, not half-asleep)
This is irreversible and a fat-fingered address is unrecoverable — do it awake.
Transfer all 7 Ownable2Step contracts to a Safe multisig (two-step), from the
current owner `0xCBC88Ba9…`:
```
# for each: StockRouteRegistry, StockDotFunFactoryV2, StockRewardTreasury,
#           GraduationManager, V4LiquidityLocker, CreatorRewardVaultV2, VersionRegistry
cast send <contract> "transferOwnership(address)" <SAFE_ADDR> --rpc-url $RHC_RPC_URL --private-key 0x<owner>
# then from the Safe: acceptOwnership() on each.
```

## 5. Independent audit  (before real volume)
V2 is unaudited and custodies real funds. Get an audit before you promote it
widely. This is the one thing no amount of testing substitutes for.

---

### Live V2 addresses
| Contract | Address |
|---|---|
| Factory | `0x470aca74d71269833de8cf65640dfb558393569e` |
| StockRouteRegistry | `0xf1c7181324dec91bf0fb94a2f05608927e06b97c` |
| StockRewardTreasury | `0x284c47ef1754fa82b85cbe8207dd749e6f9ca389` |
| GraduationManager | `0x408fa5743a43de08c596169b58f11e303026d835` |
| ConversionAdapter | `0xee348959309506e9c9ec302fa449b25b767ff51b` |
| GraduationAdapter | `0x74993f85f42ba26d613c37cb82b0c5f586a22d39` |
| LiquidityLocker | `0x19f19e9e6b414e0e128597289dda4c218d9c7aa1` |
| CreatorRewardVault | `0x343151434ef2f86d0ff96af0b68e7986b1c33b6c` |
| VersionRegistry | `0x373310d5c291a5d69b22295a4118bd4087b60aec` |
| Owner / Keeper | `0xCBC88Ba9…` (migrate to multisig) |
| Treasury | `0x988a17…` |
