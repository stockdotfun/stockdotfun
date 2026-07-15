/**
 * Flap protocol integration — shared types.
 *
 * Source of truth is on-chain Portal state on Robinhood Chain (chain 4663).
 * All addresses/enums here mirror the VERIFIED deployment in
 * config/flap.robinhood.json (see docs/integrations/flap-robinhood-verification.md).
 */

/** Flap Portal token lifecycle status (TokenStatus enum, verified on-chain). */
export enum FlapTokenStatus {
  Invalid = 0,
  Tradable = 1, // bonding curve
  InDuel = 2, // obsolete
  Killed = 3, // obsolete
  DEX = 4, // graduated — trades on a migrated DEX pool
  Staged = 5,
}

/** StockDotFun-side integration lifecycle for a discovered Flap token. */
export enum FlapIntegrationStatus {
  DISCOVERED = "DISCOVERED",
  BONDING_CURVE = "BONDING_CURVE",
  GRADUATION_PENDING_CONFIRMATION = "GRADUATION_PENDING_CONFIRMATION",
  VERIFIED_GRADUATED = "VERIFIED_GRADUATED",
  TRADING_ENABLED = "TRADING_ENABLED",
  TRADING_PAUSED = "TRADING_PAUSED",
  INVALID = "INVALID",
  REMOVED = "REMOVED",
}

/** Decoded getTokenV7(address) return — the Portal's token state view. */
export type FlapTokenStateV7 = {
  status: FlapTokenStatus;
  reserve: bigint;
  circulatingSupply: bigint;
  price: bigint;
  tokenVersion: number;
  r: bigint;
  h: bigint;
  k: bigint;
  dexSupplyThresh: bigint;
  /** address(0) = native ETH quote (the case on Robinhood Chain). */
  quoteTokenAddress: `0x${string}`;
  nativeToQuoteSwapEnabled: boolean;
  extensionID: `0x${string}`;
  /** Single tax rate (bps) in V7. */
  taxRate: bigint;
  /** DEX pool after graduation; address(0) while on the bonding curve. */
  pool: `0x${string}`;
  /** 0..1e18 progress toward graduation. */
  progress: bigint;
  lpFeeProfile: number;
  dexId: number;
};

/** A graduated Flap token proven on-chain (status=DEX + verified pool). */
export type VerifiedFlapGraduation = {
  token: `0x${string}`;
  pool: `0x${string}`;
  /** WETH-paired V2 fork pair on RHC. */
  factory: `0x${string}`;
  quoteToken: `0x${string}`;
  reserveWeth: bigint;
  reserveToken: bigint;
  buyTaxBps: number;
  sellTaxBps: number;
};
