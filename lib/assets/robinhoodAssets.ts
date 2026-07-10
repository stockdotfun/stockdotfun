import type { StockAsset } from "@/types/token";

/**
 * CANONICAL SUPPORTED-ASSET REGISTRY — Robinhood Chain mainnet (chain id 4663).
 *
 * Every address here was verified on 2026-07-10 against ALL of:
 *   1. Official docs: https://docs.robinhood.com/chain/contracts/
 *   2. On-chain reads (name/symbol/decimals/totalSupply) via
 *      https://rpc.mainnet.chain.robinhood.com
 *   3. Blockscout: https://robinhoodchain.blockscout.com/api/v2/tokens/{addr}
 *
 * Full evidence: docs/mainnet-verification/token-address-verification.md
 *
 * DO NOT add addresses from any other source. DO NOT edit addresses without
 * re-running the verification procedure. `npm run check:config` fails the
 * build if mock/placeholder addresses leak into this file.
 *
 * `enabled: false` assets verified fine but have thin holder bases on
 * Robinhood Chain (see verification doc) — enable deliberately, not by default.
 */

const BLOCKSCOUT = "https://robinhoodchain.blockscout.com/token";

const asset = (
  a: Omit<StockAsset, "source" | "blockscoutUrl" | "priceFeed" | "decimals"> & {
    decimals?: number;
    priceFeed?: `0x${string}` | null;
  },
): StockAsset => ({
  decimals: 18,
  priceFeed: null,
  source: "robinhood-docs",
  blockscoutUrl: `${BLOCKSCOUT}/${a.address}`,
  ...a,
});

/** Base/utility assets — quote + stable. Never selectable as a meme pair. */
export const BASE_ASSETS: StockAsset[] = [
  asset({
    symbol: "WETH",
    name: "WETH",
    displayName: "Wrapped Ether",
    address: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
    type: "BASE_TOKEN",
    enabled: true,
    riskLabel: "standard",
  }),
  asset({
    symbol: "USDG",
    name: "Global Dollar",
    displayName: "Global Dollar (USDG)",
    address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
    type: "BASE_TOKEN",
    decimals: 6,
    enabled: true,
    riskLabel: "standard",
  }),
];

/** Robinhood tokenized stock assets. */
export const STOCK_ASSETS: StockAsset[] = [
  asset({ symbol: "AAPL", name: "Apple • Robinhood Token", displayName: "Apple", address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9", type: "STOCK_TOKEN", enabled: true, riskLabel: "standard" }),
  asset({ symbol: "AMD", name: "AMD • Robinhood Token", displayName: "AMD", address: "0x86923f96303D656E4aa86D9d42D1e57ad2023fdC", type: "STOCK_TOKEN", enabled: true, riskLabel: "standard" }),
  asset({ symbol: "AMZN", name: "Amazon • Robinhood Token", displayName: "Amazon", address: "0x12f190a9F9d7D37a250758b26824B97CE941bF54", type: "STOCK_TOKEN", enabled: true, riskLabel: "standard" }),
  asset({ symbol: "BABA", name: "Alibaba • Robinhood Token", displayName: "Alibaba", address: "0xad25Ac6C84D497db898fa1E8387bf6Af3532a1c4", type: "STOCK_TOKEN", enabled: false, riskLabel: "low-liquidity", note: "Thin holder base on Robinhood Chain at verification time." }),
  asset({ symbol: "BE", name: "Bloom Energy • Robinhood Token", displayName: "Bloom Energy", address: "0x822CC93fFD030293E9842c30BBD678F530701867", type: "STOCK_TOKEN", enabled: true, riskLabel: "standard" }),
  asset({ symbol: "COIN", name: "Coinbase • Robinhood Token", displayName: "Coinbase", address: "0x6330D8C3178a418788dF01a47479c0ce7CCF450b", type: "STOCK_TOKEN", enabled: true, riskLabel: "standard" }),
  asset({ symbol: "CRCL", name: "Circle Internet Group • Robinhood Token", displayName: "Circle", address: "0xdF0992E440dD0be65BD8439b609d6D4366bf1CB5", type: "STOCK_TOKEN", enabled: false, riskLabel: "low-liquidity", note: "Thin holder base on Robinhood Chain at verification time." }),
  asset({ symbol: "CRWV", name: "CoreWeave • Robinhood Token", displayName: "CoreWeave", address: "0x5f10A1C971B69e47e059e1dC91901B59b3fB49C3", type: "STOCK_TOKEN", enabled: true, riskLabel: "standard" }),
  asset({ symbol: "GOOGL", name: "Alphabet Class A • Robinhood Token", displayName: "Alphabet", address: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3", type: "STOCK_TOKEN", enabled: true, riskLabel: "standard" }),
  asset({ symbol: "INTC", name: "Intel • Robinhood Token", displayName: "Intel", address: "0xc72b96e0E48ecd4DC75E1e45396e26300BC39681", type: "STOCK_TOKEN", enabled: true, riskLabel: "standard" }),
  asset({ symbol: "META", name: "Meta Platforms • Robinhood Token", displayName: "Meta", address: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35", type: "STOCK_TOKEN", enabled: true, riskLabel: "standard" }),
  asset({ symbol: "MSFT", name: "Microsoft • Robinhood Token", displayName: "Microsoft", address: "0xe93237C50D904957Cf27E7B1133b510C669c2e74", type: "STOCK_TOKEN", enabled: true, riskLabel: "standard" }),
  asset({ symbol: "MU", name: "Micron Technology • Robinhood Token", displayName: "Micron", address: "0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD", type: "STOCK_TOKEN", enabled: true, riskLabel: "standard" }),
  asset({ symbol: "NVDA", name: "NVIDIA • Robinhood Token", displayName: "NVIDIA", address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC", type: "STOCK_TOKEN", enabled: true, riskLabel: "standard" }),
  asset({ symbol: "ORCL", name: "Oracle • Robinhood Token", displayName: "Oracle", address: "0xb0992820E760d836549ba69BC7598b4af75dEE03", type: "STOCK_TOKEN", enabled: true, riskLabel: "standard" }),
  asset({ symbol: "PLTR", name: "Palantir Technologies • Robinhood Token", displayName: "Palantir", address: "0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A", type: "STOCK_TOKEN", enabled: true, riskLabel: "standard" }),
  asset({ symbol: "SNDK", name: "Sandisk Corporation • Robinhood Token", displayName: "Sandisk", address: "0xB90A19fF0Af67f7779afF50A882A9CfF42446400", type: "STOCK_TOKEN", enabled: true, riskLabel: "standard" }),
  asset({ symbol: "SPCX", name: "SpaceX • Robinhood Token", displayName: "SpaceX", address: "0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa", type: "STOCK_TOKEN", enabled: true, riskLabel: "private-market", note: "Private-market exposure token. Pricing/liquidity may differ from public equities." }),
  asset({ symbol: "TSLA", name: "Tesla • Robinhood Token", displayName: "Tesla", address: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d", type: "STOCK_TOKEN", enabled: true, riskLabel: "standard" }),
  asset({ symbol: "USAR", name: "USA Rare Earth • Robinhood Token", displayName: "USA Rare Earth", address: "0xd917B029C761D264c6A312BBbcDA868658eF86a6", type: "STOCK_TOKEN", enabled: true, riskLabel: "standard" }),
];

/** Robinhood tokenized ETF assets. */
export const ETF_ASSETS: StockAsset[] = [
  asset({ symbol: "QQQ", name: "Invesco QQQ • Robinhood Token", displayName: "Invesco QQQ", address: "0xD5f3879160bc7c32ebb4dC785F8a4F505888de68", type: "ETF_TOKEN", enabled: false, riskLabel: "low-liquidity", note: "Thin holder base on Robinhood Chain at verification time." }),
  asset({ symbol: "SGOV", name: "iShares 0-3 Month Treasury Bond • Robinhood Token", displayName: "iShares 0-3M Treasury", address: "0x92FD66527192E3e61d4DDd13322Aa222DE86F9B5", type: "ETF_TOKEN", enabled: false, riskLabel: "low-liquidity", note: "Thin holder base on Robinhood Chain at verification time." }),
  asset({ symbol: "SLV", name: "iShares Silver Trust • Robinhood Token", displayName: "iShares Silver", address: "0x411eFb0E7f985935DAec3D4C3ebaEa0d0AD7D89f", type: "ETF_TOKEN", enabled: false, riskLabel: "low-liquidity", note: "Thin holder base on Robinhood Chain at verification time." }),
  asset({ symbol: "SPY", name: "SPDR S&P 500 ETF Trust • Robinhood Token", displayName: "SPDR S&P 500", address: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C", type: "ETF_TOKEN", enabled: true, riskLabel: "standard" }),
  asset({ symbol: "USO", docsSymbol: "CUSO", name: "United States Oil Fund • Robinhood Token", displayName: "US Oil Fund", address: "0xa30FA36Db767ad9eD3f7a60fC79526fB4d56D344", type: "ETF_TOKEN", enabled: false, riskLabel: "low-liquidity", note: "Docs list this as CUSO; on-chain symbol() is USO. Thin holder base." }),
];

/** Assets selectable as a meme-coin pair (stocks + ETFs, never base tokens). */
export const PAIRABLE_ASSETS: StockAsset[] = [...STOCK_ASSETS, ...ETF_ASSETS];

/** Everything, including base assets. */
export const ALL_ASSETS: StockAsset[] = [...BASE_ASSETS, ...PAIRABLE_ASSETS];
