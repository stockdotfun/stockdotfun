/** ERC20 token metadata pinned to IPFS at launch (Part 8). */
export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string; // ipfs://CID
  website?: string;
  twitter?: string;
  telegram?: string;
  pairedStock: {
    symbol: string;
    address: string;
    chainId: number;
  };
  imageSha256: string; // content hash of the source image
}

export interface UploadResult {
  imageUri: string; // ipfs://CID
  metadataUri: string; // ipfs://CID
  contentHash: string; // sha256 hex of the image
}

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB

const IMAGE_MAGIC: Record<string, number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/gif": [0x47, 0x49, 0x46, 0x38],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
};

/** Basic anti-spoofing: the declared content-type must match magic bytes. */
export function imageBytesMatchType(bytes: Uint8Array, contentType: string): boolean {
  const magic = IMAGE_MAGIC[contentType];
  if (!magic) return false;
  return magic.every((b, i) => bytes[i] === b);
}

export function validateStringField(v: unknown, name: string, max: number): string {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  if (v.length > max) throw new Error(`${name} too long`);
  return v.trim();
}
