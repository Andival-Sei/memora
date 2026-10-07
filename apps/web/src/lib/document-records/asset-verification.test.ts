import {describe, expect, it} from "vitest";
import {DocumentAssetVerificationError, verifyDocumentAsset} from "./asset-verification";

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
}

describe("private document asset verification", () => {
  it("checks the storage metadata and actual PDF/image signatures before hashing", async () => {
    const pdf = new TextEncoder().encode("%PDF-1.7 private");
    const result = await verifyDocumentAsset({
      body: streamOf(pdf),
      contentType: "application/pdf",
      actualContentType: "application/pdf",
      actualSizeBytes: pdf.length
    });
    expect(result.sizeBytes).toBe(pdf.length);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);

    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
    await expect(verifyDocumentAsset({
      body: streamOf(jpeg),
      contentType: "image/jpeg",
      actualContentType: "image/jpeg",
      actualSizeBytes: jpeg.length
    })).resolves.toHaveProperty("sha256");
  });

  it("rejects mismatched MIME, size, and file signatures", async () => {
    const bytes = new TextEncoder().encode("not an image");
    await expect(verifyDocumentAsset({
      body: streamOf(bytes), contentType: "image/png", actualContentType: "image/png", actualSizeBytes: bytes.length
    })).rejects.toBeInstanceOf(DocumentAssetVerificationError);
    await expect(verifyDocumentAsset({
      body: streamOf(bytes), contentType: "image/jpeg", actualContentType: "image/png", actualSizeBytes: bytes.length
    })).rejects.toBeInstanceOf(DocumentAssetVerificationError);
    await expect(verifyDocumentAsset({
      body: streamOf(bytes), contentType: "application/pdf", actualContentType: "application/pdf", actualSizeBytes: bytes.length + 1
    })).rejects.toBeInstanceOf(DocumentAssetVerificationError);
  });
});
