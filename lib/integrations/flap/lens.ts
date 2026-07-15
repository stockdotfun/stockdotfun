/**
 * Flap "Portal Lens" façade. On Robinhood Chain there is no separate Lens
 * contract — the getToken* views live on the Portal itself. This module re-exports
 * the honest read helpers under lens-style names for the integration layer.
 */
export { getFlapTokenState as inspectToken, isGraduatedStatus, resolveGraduation, FLAP, flapEnabled } from "./portal";
export { FlapTokenStatus, FlapIntegrationStatus } from "./types";
export type { FlapTokenStateV7, VerifiedFlapGraduation } from "./types";
