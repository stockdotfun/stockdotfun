/**
 * Token image/metadata storage abstraction.
 *
 * TODO(storage): plug in a real backend — Pinata (IPFS), Arweave, S3,
 * Supabase Storage, or Cloudflare R2. Implement `StorageAdapter` and swap it
 * in `getStorageAdapter()`; nothing else in the app changes.
 */
export interface StorageAdapter {
  readonly name: string;
  readonly isConfigured: boolean;
  /** Uploads the image and returns a permanent URL/URI. */
  uploadImage(file: File): Promise<string>;
  /** Uploads token metadata JSON and returns its URI. */
  uploadMetadata(metadata: Record<string, unknown>): Promise<string>;
}

/** Local placeholder: object URLs for preview only — nothing is persisted. */
const localPreviewAdapter: StorageAdapter = {
  name: "local-preview",
  isConfigured: false,
  async uploadImage(file: File) {
    return URL.createObjectURL(file);
  },
  async uploadMetadata() {
    throw new Error(
      "Metadata storage is not configured. Connect a storage backend (see lib/storage/upload.ts).",
    );
  },
};

export function getStorageAdapter(): StorageAdapter {
  return localPreviewAdapter;
}

// ---------------------------------------------------------------------------
// Permanent metadata (Part 8). Image + metadata JSON are pinned to IPFS by the
// server-side /api/metadata route (PINATA_JWT stays server-only). The client
// never sees the key; it only learns whether storage is configured via the
// public hint below, and fails closed otherwise (no blank metadata URI).
// ---------------------------------------------------------------------------

import type { UploadResult } from "@/lib/metadata/types";

export const metadataStorageConfigured =
  process.env.NEXT_PUBLIC_METADATA_CONFIGURED === "true";

export interface LaunchMetadataInput {
  image: File;
  name: string;
  symbol: string;
  description: string;
  stockSymbol: string;
  stockAddress: string;
  website?: string;
  twitter?: string;
  telegram?: string;
}

/** Pin the launch image + metadata; returns the permanent ipfs:// URIs. */
export async function uploadTokenLaunchMetadata(
  input: LaunchMetadataInput,
): Promise<UploadResult> {
  const fd = new FormData();
  // Use a fixed ASCII filename. The uploaded file's original name can contain
  // characters (e.g. "•") outside Latin-1, which can't be encoded into the
  // multipart Content-Disposition header and makes fetch throw a ByteString
  // error before sending. The server re-names the file for pinning regardless.
  const ext = (input.image.type.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "");
  fd.append("image", input.image, `meme.${ext}`);
  fd.append("name", input.name);
  fd.append("symbol", input.symbol);
  fd.append("description", input.description);
  fd.append("stockSymbol", input.stockSymbol);
  fd.append("stockAddress", input.stockAddress);
  if (input.website) fd.append("website", input.website);
  if (input.twitter) fd.append("twitter", input.twitter);
  if (input.telegram) fd.append("telegram", input.telegram);

  const res = await fetch("/api/metadata", { method: "POST", body: fd });
  if (res.status === 503) {
    throw new Error(
      "Metadata storage is not configured. Set PINATA_JWT (server) and NEXT_PUBLIC_METADATA_CONFIGURED=true.",
    );
  }
  const json = (await res.json().catch(() => null)) as
    | (UploadResult & { message?: string })
    | null;
  if (!res.ok || !json) {
    throw new Error(json?.message ?? "Metadata upload failed.");
  }
  return json;
}
