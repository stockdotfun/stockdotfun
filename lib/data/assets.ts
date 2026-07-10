/**
 * Back-compat shim — the canonical registry lives in lib/assets/.
 * SUPPORTED_ASSETS = assets selectable as a meme-coin pair.
 */
export { PAIRABLE_ASSETS as SUPPORTED_ASSETS } from "@/lib/assets/robinhoodAssets";
export {
  ALL_ASSETS,
  BASE_ASSETS,
  STOCK_ASSETS,
  ETF_ASSETS,
} from "@/lib/assets/robinhoodAssets";
