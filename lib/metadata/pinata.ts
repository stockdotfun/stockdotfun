/**
 * Server-only Pinata/IPFS pinning (Part 8). The PINATA_JWT secret NEVER reaches
 * the browser — all pinning happens in the /api/metadata route handler.
 *
 * Set PINATA_JWT (server) and NEXT_PUBLIC_METADATA_CONFIGURED=true (client hint)
 * to enable permanent metadata. Optional CF R2/S3 backup can be layered here.
 */
import "server-only";

const PINATA_API = "https://api.pinata.cloud";

export const metadataConfigured = !!process.env.PINATA_JWT;

function jwt(): string {
  // A valid Pinata JWT is base64url segments joined by dots (chars A-Za-z0-9._-).
  // Strip whitespace and any stray characters (e.g. a "•" from a bad paste),
  // which would otherwise make the Authorization header throw a ByteString error.
  const t = process.env.PINATA_JWT?.replace(/[^A-Za-z0-9._-]/g, "");
  if (!t) throw new Error("PINATA_JWT not set");
  return t;
}

/** Pin raw bytes; returns an ipfs:// URI. */
export async function pinFile(bytes: Uint8Array, filename: string, contentType: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([bytes as BlobPart], { type: contentType }), filename);
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const res = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt()}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Pinata pinFile failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { IpfsHash: string };
  return `ipfs://${json.IpfsHash}`;
}

/** Pin a JSON object; returns an ipfs:// URI. */
export async function pinJSON(obj: unknown): Promise<string> {
  const res = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ pinataContent: obj, pinataOptions: { cidVersion: 1 } }),
  });
  if (!res.ok) throw new Error(`Pinata pinJSON failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { IpfsHash: string };
  return `ipfs://${json.IpfsHash}`;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
