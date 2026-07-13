/**
 * Bonding-curve constants (set by StockDotFunFactoryV2 for every token) and the
 * market cap at which a token graduates ("bonds").
 *
 * The curve is constant-product with virtual reserves. A token graduates when
 * realQuote reaches GRADUATION_TARGET_ETH; the market cap there is derived from
 * the curve and is the SAME for every token, since the factory uses fixed
 * params. Verified against the live pool (virtualQuote 3, virtualToken 73M,
 * graduationTarget 4.4, curve supply 1e9) → ≈ 17.01 ETH.
 */
const VIRTUAL_QUOTE_ETH = 3;
const VIRTUAL_TOKEN = 73_000_000;
const GRADUATION_TARGET_ETH = 4.4;
const CURVE_SUPPLY = 1_000_000_000; // tokens seeded onto the curve

export { GRADUATION_TARGET_ETH };

/** Market cap in ETH at graduation (price-per-token at the target × supply). */
export const GRADUATION_MARKET_CAP_ETH = (() => {
  const k = VIRTUAL_QUOTE_ETH * (VIRTUAL_TOKEN + CURVE_SUPPLY);
  const tokenReserveAtGrad = k / (VIRTUAL_QUOTE_ETH + GRADUATION_TARGET_ETH) - VIRTUAL_TOKEN;
  const priceAtGrad =
    (VIRTUAL_QUOTE_ETH + GRADUATION_TARGET_ETH) / (VIRTUAL_TOKEN + tokenReserveAtGrad);
  return priceAtGrad * CURVE_SUPPLY;
})();

/**
 * Live market cap (ETH) for a curve pool given its realQuote (ETH). Constant
 * product: price = (vq + rq)² / K, mcap = price × supply. Matches the pool's
 * on-chain terminalPrice exactly (verified: rq=0 → 2.796 ETH).
 */
export function curveMcapEth(realQuoteEth: number): number {
  const k = VIRTUAL_QUOTE_ETH * (VIRTUAL_TOKEN + CURVE_SUPPLY);
  const price = (VIRTUAL_QUOTE_ETH + realQuoteEth) ** 2 / k;
  return price * CURVE_SUPPLY;
}
