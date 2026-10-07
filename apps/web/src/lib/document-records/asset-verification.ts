import {createHash} from "node:crypto";
import {DOCUMENT_RECORD_MAX_ASSET_BYTES} from "@memora/domain";
import type {DocumentAssetContentType} from "@memora/contracts";

export class DocumentAssetVerificationError extends Error {
  readonly code = "INVALID_ASSET" as const;

  constructor() {
    super("Document asset did not pass verification.");
    this.name = "DocumentAssetVerificationError";
  }
}

function hasExpectedSignature(bytes: Uint8Array, contentType: DocumentAssetContentType): boolean {
  if (contentType === "application/pdf") {
    return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
  }
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
}

export async function verifyDocumentAsset(input: {
  body: ReadableStream<Uint8Array>;
  contentType: DocumentAssetContentType;
  actualContentType: string;
  actualSizeBytes: number;
}): Promise<{sizeBytes: number; sha256: string}> {
  if (input.actualContentType !== input.contentType || !Number.isSafeInteger(input.actualSizeBytes) ||
      input.actualSizeBytes <= 0 || input.actualSizeBytes > DOCUMENT_RECORD_MAX_ASSET_BYTES) {
    throw new DocumentAssetVerificationError();
  }

  const reader = input.body.getReader();
  const chunks: Uint8Array[] = [];
  let sizeBytes = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      if (!value) continue;
      sizeBytes += value.byteLength;
      if (sizeBytes > DOCUMENT_RECORD_MAX_ASSET_BYTES || sizeBytes > input.actualSizeBytes) {
        await reader.cancel();
        throw new DocumentAssetVerificationError();
      }
      chunks.push(value);
    }
  } catch {
    throw new DocumentAssetVerificationError();
  } finally {
    reader.releaseLock();
  }

  if (sizeBytes !== input.actualSizeBytes) throw new DocumentAssetVerificationError();
  const bytes = new Uint8Array(sizeBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (!hasExpectedSignature(bytes, input.contentType)) throw new DocumentAssetVerificationError();
  return {sizeBytes, sha256: createHash("sha256").update(bytes).digest("hex")};
}
