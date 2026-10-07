import {beforeEach, describe, expect, it, vi} from "vitest";
import {del, get, put} from "@vercel/blob";
import {createPrivateBlobStore, getPrivateBlobAsset} from "./blob-storage";

vi.mock("@vercel/blob", () => ({
  del: vi.fn(),
  get: vi.fn(),
  put: vi.fn()
}));

describe("private Blob adapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("writes with private access and immutable server pathname", async () => {
    vi.mocked(put).mockResolvedValue({url: "https://blob.invalid/private"} as never);
    const store = createPrivateBlobStore();
    const bytes = new TextEncoder().encode("%PDF-").buffer;

    await store.put("vaults/vault-1/documents/document-1.pdf", bytes, "application/pdf");

    expect(put).toHaveBeenCalledWith(
      "vaults/vault-1/documents/document-1.pdf",
      bytes,
      expect.objectContaining({
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "application/pdf",
        cacheControlMaxAge: 0
      })
    );
  });

  it("reads without cache and never converts a private blob into a public URL", async () => {
    const body = new ReadableStream<Uint8Array>();
    vi.mocked(get).mockResolvedValue({
      statusCode: 200,
      stream: body,
      blob: {contentType: "application/pdf", size: 24}
    } as never);
    const store = createPrivateBlobStore();

    await expect(store.get("vaults/vault-1/documents/document-1.pdf")).resolves.toEqual({body});
    expect(get).toHaveBeenCalledWith(
      "vaults/vault-1/documents/document-1.pdf",
      {access: "private", useCache: false}
    );
  });

  it("returns only private asset metadata and its stream, never a Blob URL", async () => {
    const body = new ReadableStream<Uint8Array>();
    vi.mocked(get).mockResolvedValue({
      statusCode: 200,
      stream: body,
      blob: {url: "https://blob.invalid/private", contentType: "image/jpeg", size: 15}
    } as never);

    const result = await getPrivateBlobAsset("vaults/vault-1/document-records/record-1/page.jpg");

    expect(result).toEqual({body, contentType: "image/jpeg", sizeBytes: 15});
    expect(result).not.toHaveProperty("url");
  });

  it("treats a conditional 304 or missing stream as unavailable", async () => {
    vi.mocked(get).mockResolvedValue({statusCode: 304, stream: null, blob: {contentType: null, size: null}} as never);
    await expect(createPrivateBlobStore().get("missing.pdf")).resolves.toBeNull();
  });

  it("deletes only the server-generated pathname", async () => {
    vi.mocked(del).mockResolvedValue(undefined);
    await createPrivateBlobStore().delete("vaults/vault-1/documents/document-1.pdf");
    expect(del).toHaveBeenCalledWith("vaults/vault-1/documents/document-1.pdf");
  });
});
