/**
 * POST /api/metadata — validate + pin a token's image and metadata JSON to IPFS
 * (Part 8). Returns { imageUri, metadataUri, contentHash }. Responds 503 when
 * PINATA_JWT is not configured so the UI can fail closed (no blank metadata).
 */
import { pinFile, pinJSON, sha256Hex, metadataConfigured } from "@/lib/metadata/pinata";
import {
  MAX_IMAGE_BYTES,
  imageBytesMatchType,
  validateStringField,
  type TokenMetadata,
} from "@/lib/metadata/types";

export const dynamic = "force-dynamic";

const CHAIN_ID = 4663;

export async function POST(request: Request): Promise<Response> {
  if (!metadataConfigured) {
    return Response.json(
      { error: "storage_not_configured", message: "PINATA_JWT is not set on the server." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "bad_request", message: "Expected multipart form data." }, { status: 400 });
  }

  try {
    const image = form.get("image");
    if (!(image instanceof File)) throw new Error("image file is required");
    if (image.size === 0 || image.size > MAX_IMAGE_BYTES) throw new Error("image must be 1 byte–4 MB");

    const bytes = new Uint8Array(await image.arrayBuffer());
    if (!imageBytesMatchType(bytes, image.type)) {
      throw new Error("image content does not match its declared type");
    }

    const name = validateStringField(form.get("name"), "name", 64);
    const symbol = validateStringField(form.get("symbol"), "symbol", 16);
    const description = validateStringField(form.get("description"), "description", 2000);
    const stockSymbol = validateStringField(form.get("stockSymbol"), "stockSymbol", 16);
    const stockAddress = validateStringField(form.get("stockAddress"), "stockAddress", 42);
    const website = optional(form.get("website"));
    const twitter = optional(form.get("twitter"));
    const telegram = optional(form.get("telegram"));

    const contentHash = await sha256Hex(bytes);
    const imageUri = await pinFile(bytes, `${symbol}-${contentHash.slice(0, 12)}`, image.type);

    const metadata: TokenMetadata = {
      name,
      symbol,
      description,
      image: imageUri,
      website,
      twitter,
      telegram,
      pairedStock: { symbol: stockSymbol, address: stockAddress, chainId: CHAIN_ID },
      imageSha256: contentHash,
    };
    const metadataUri = await pinJSON(metadata);

    return Response.json({ imageUri, metadataUri, contentHash });
  } catch (e) {
    const message = e instanceof Error ? e.message : "upload failed";
    return Response.json({ error: "upload_failed", message }, { status: 400 });
  }
}

function optional(v: FormDataEntryValue | null): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}
