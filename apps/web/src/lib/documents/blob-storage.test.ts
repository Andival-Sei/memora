import {beforeEach, describe, expect, it, vi} from "vitest";
import {del, get, put} from "@vercel/blob";
import {createPrivateBlobStore} from "./blob-storage";

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
    vi.mocked(get).mockResolvedValue({statusCode: 200, stream: body} as never);
    const store = createPrivateBlobStore();

    await expect(store.get("vaults/vault-1/documents/document-1.pdf")).resolves.toEqual({body});
    expect(get).toHaveBeenCalledWith(
      "vaults/vault-1/documents/document-1.pdf",
      {access: "private", useCache: false}
    );
  });

  it("treats a conditional 304 or missing stream as unavailable", async () => {
    vi.mocked(get).mockResolvedValue({statusCode: 304, stream: null} as never);
    await expect(createPrivateBlobStore().get("missing.pdf")).resolves.toBeNull();
  });

  it("deletes only the server-generated pathname", async () => {
    vi.mocked(del).mockResolvedValue(undefined);
    await createPrivateBlobStore().delete("vaults/vault-1/documents/document-1.pdf");
    expect(del).toHaveBeenCalledWith("vaults/vault-1/documents/document-1.pdf");
  });
});
