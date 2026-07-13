/**
 * Platform configuration.
 *
 * Network defaults are the OFFICIAL, VERIFIED Robinhood Chain mainnet values
 * (docs.robinhood.com/chain + live RPC + Blockscout verification on
 * 2026-07-10 — see docs/mainnet-verification/token-address-verification.md).
 * Everything remains overridable via env; StockDotFun contract addresses are
 * NEVER defaulted — they must arrive via env after a real deployment.
 */

export const ROBINHOOD_MAINNET_CHAIN_ID = 4663;
export const ROBINHOOD_TESTNET_CHAIN_ID = 46630;

const VERIFIED_DEFAULTS = {
  chainId: ROBINHOOD_MAINNET_CHAIN_ID,
  rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
  explorerUrl: "https://robinhoodchain.blockscout.com",
  weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as const,
  usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as const,
} as const;

function envAddress(value: string | undefined): `0x${string}` | null {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) return null;
  return value as `0x${string}`;
}

const chainId = process.env.NEXT_PUBLIC_CHAIN_ID
  ? Number(process.env.NEXT_PUBLIC_CHAIN_ID)
  : VERIFIED_DEFAULTS.chainId;

export type AppEnv = "mainnet" | "testnet" | "local";

export const appEnv: AppEnv =
  chainId === ROBINHOOD_MAINNET_CHAIN_ID
    ? "mainnet"
    : chainId === ROBINHOOD_TESTNET_CHAIN_ID
      ? "testnet"
      : "local";

/** Alchemy RPC preferred for production throughput; public RPC as fallback. */
const alchemyRpc = process.env.NEXT_PUBLIC_ALCHEMY_RHC_RPC_URL || null;
const publicRpc = process.env.NEXT_PUBLIC_RHC_RPC_URL || VERIFIED_DEFAULTS.rpcUrl;

export const platformConfig = {
  chainId,
  rpcUrl: alchemyRpc ?? publicRpc,
  publicRpcUrl: publicRpc,
  usingAlchemy: alchemyRpc !== null,
  explorerUrl:
    process.env.NEXT_PUBLIC_RHC_EXPLORER_URL || VERIFIED_DEFAULTS.explorerUrl,

  addresses: {
    // Base assets: verified official defaults, env-overridable.
    weth:
      envAddress(process.env.NEXT_PUBLIC_WETH_ADDRESS) ?? VERIFIED_DEFAULTS.weth,
    usdg:
      envAddress(process.env.NEXT_PUBLIC_USDG_ADDRESS) ?? VERIFIED_DEFAULTS.usdg,
    // StockDotFun contracts: NO defaults — set only after real deployment.
    factory: envAddress(process.env.NEXT_PUBLIC_FACTORY_ADDRESS),
    router: envAddress(process.env.NEXT_PUBLIC_ROUTER_ADDRESS),
    registry: envAddress(process.env.NEXT_PUBLIC_STOCK_ASSET_REGISTRY_ADDRESS),
    rewardVault: envAddress(process.env.NEXT_PUBLIC_REWARD_VAULT_ADDRESS),
    creatorRewardVault: envAddress(
      process.env.NEXT_PUBLIC_CREATOR_REWARD_VAULT_ADDRESS,
    ),
    treasury: envAddress(process.env.NEXT_PUBLIC_PROTOCOL_TREASURY),
    // CurveZap: 1-transaction ETH buys/sells (wrap+approve+trade atomically).
    // When unset, trading falls back to the multi-step wrap/approve flow.
    zap: envAddress(process.env.NEXT_PUBLIC_ZAP_ADDRESS),
  },

  /**
   * Demo mode shows clearly-labeled sample data. It is HARD-BLOCKED on
   * mainnet: even NEXT_PUBLIC_DEMO_MODE=true cannot enable it when the
   * configured chain is Robinhood Chain mainnet.
   */
  demoMode:
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" &&
    chainId !== ROBINHOOD_MAINNET_CHAIN_ID,
} as const;

export const isChainConfigured = true; // network defaults are verified

export const areContractsConfigured =
  platformConfig.addresses.factory !== null &&
  platformConfig.addresses.registry !== null;

/** Reward routing requires an explicitly configured, verified router adapter. */
export const isRoutingConfigured = platformConfig.addresses.router !== null;

export const explorerTxUrl = (hash: string) =>
  `${platformConfig.explorerUrl.replace(/\/$/, "")}/tx/${hash}`;

export const explorerAddressUrl = (address: string) =>
  `${platformConfig.explorerUrl.replace(/\/$/, "")}/address/${address}`;
