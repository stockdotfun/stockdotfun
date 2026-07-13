/**
 * Resolve an ipfs:// URI (or bare CID) to an HTTP gateway URL for the browser.
 * Content is pinned on Pinata, so the Pinata public gateway is the default;
 * override with NEXT_PUBLIC_IPFS_GATEWAY (e.g. a dedicated Pinata gateway).
 */
const GATEWAY = (
  process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://gateway.pinata.cloud/ipfs"
).replace(/\/+$/, "");

export function ipfsToHttp(uri?: string | null): string | null {
  if (!uri) return null;
  const trimmed = uri.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("ipfs://")) {
    const path = trimmed.slice("ipfs://".length).replace(/^ipfs\//, "");
    return `${GATEWAY}/${path}`;
  }
  // Bare CID (v0 "Qm…" or v1 "baf…") optionally with a path.
  if (/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]+)(\/.*)?$/.test(trimmed)) {
    return `${GATEWAY}/${trimmed}`;
  }
  return null;
}
