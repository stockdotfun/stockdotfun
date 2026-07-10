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
