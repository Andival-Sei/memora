import {beforeEach, describe, expect, it, vi} from "vitest";

const {authMock, intakeMock, getBlobMock} = vi.hoisted(() => ({
  authMock: vi.fn(), intakeMock: {getPrivateAsset: vi.fn()}, getBlobMock: vi.fn()
}));
vi.mock("@clerk/nextjs/server", () => ({auth: authMock}));
vi.mock("@/lib/document-records/service", () => ({getDocumentRecordIntake: () => intakeMock}));
vi.mock("@/lib/documents/blob-storage", () => ({getPrivateBlobAsset: getBlobMock}));

import {GET} from "./route";

const recordId = "11111111-1111-4111-8111-111111111111";
const assetId = "asset-1";
const pathname = `vaults/vault-1/document-records/${recordId}/page-1.jpg`;
const params = Promise.resolve({recordId, assetId});
const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);

describe("authenticated document asset delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({userId: "clerk-user-1"});
    intakeMock.getPrivateAsset.mockResolvedValue({pathname, contentType: "image/jpeg", sizeBytes: bytes.byteLength});
    getBlobMock.mockResolvedValue({
      body: new ReadableStream({start(controller) { controller.enqueue(bytes); controller.close(); }}),
      contentType: "image/jpeg", sizeBytes: bytes.byteLength
    });
  });

  it("streams the private asset with no-store and restrictive response headers", async () => {
    const response = await GET(new Request(`https://memora.example/api/document-records/${recordId}/assets/${assetId}`), {params});
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(getBlobMock).toHaveBeenCalledWith(pathname);
  });

  it("does not access Blob for anonymous or non-owned asset requests", async () => {
    authMock.mockResolvedValueOnce({userId: null});
    expect((await GET(new Request("https://memora.example"), {params})).status).toBe(401);
    intakeMock.getPrivateAsset.mockResolvedValueOnce(null);
    expect((await GET(new Request("https://memora.example"), {params})).status).toBe(404);
    expect(getBlobMock).not.toHaveBeenCalled();
  });
});
