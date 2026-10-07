import {beforeEach, describe, expect, it, vi} from "vitest";

const {authMock, intakeMock, blobMock} = vi.hoisted(() => ({
  authMock: vi.fn(),
  intakeMock: {
    authorizeUpload: vi.fn(),
    completeUpload: vi.fn<(userId: string, recordId: string, asset: {
      blobPath: string; contentType: string; sizeBytes: number; sha256: string
    }) => Promise<unknown>>()
  },
  blobMock: {getPrivateBlobAsset: vi.fn(), createPrivateBlobStore: vi.fn()}
}));
vi.mock("@clerk/nextjs/server", () => ({auth: authMock}));
vi.mock("@/lib/document-records/service", () => ({getDocumentRecordIntake: () => intakeMock}));
vi.mock("@/lib/documents/blob-storage", () => blobMock);

import {POST} from "./route";

const recordId = "11111111-1111-4111-8111-111111111111";
const pathname = `vaults/vault-1/document-records/${recordId}/page-1.pdf`;
const workspace = {
  id: recordId, documentType: "contract" as const, schemaVersion: 1, status: "empty" as const,
  title: null, issuedAt: null, expiresAt: null, assetCount: 1,
  createdAt: "2026-09-19T00:00:00.000Z", updatedAt: "2026-09-19T00:00:00.000Z",
  assets: [{id: "asset-1", pageIndex: 0, contentType: "application/pdf" as const, sizeBytes: 12,
    width: null, height: null, qualityStatus: "unknown" as const}]
};

function streamFor(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({start(controller) { controller.enqueue(bytes); controller.close(); }});
}

function request() {
  return new Request(`https://memora.example/api/document-records/${recordId}/assets`, {
    method: "POST", headers: {origin: "https://memora.example", "content-type": "application/json"},
    body: JSON.stringify({pathname, contentType: "application/pdf"})
  });
}

describe("private typed asset finalization route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({userId: "clerk-user-1"});
    intakeMock.authorizeUpload.mockResolvedValue(undefined);
    intakeMock.completeUpload.mockResolvedValue({workspace, duplicate: false, retainedPath: false});
    blobMock.getPrivateBlobAsset.mockResolvedValue({
      body: streamFor(new TextEncoder().encode("%PDF-1.7 test")), contentType: "application/pdf", sizeBytes: 13
    });
    blobMock.createPrivateBlobStore.mockReturnValue({delete: vi.fn()});
  });

  it("re-reads and verifies the private object before persisting metadata", async () => {
    const response = await POST(request(), {params: Promise.resolve({recordId})});
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({workspace});
    expect(intakeMock.authorizeUpload).toHaveBeenCalledWith("clerk-user-1", recordId, pathname, "application/pdf");
    const uploadCall = intakeMock.completeUpload.mock.calls[0];
    expect(uploadCall?.[0]).toBe("clerk-user-1");
    expect(uploadCall?.[1]).toBe(recordId);
    expect(uploadCall?.[2]).toMatchObject({blobPath: pathname, contentType: "application/pdf", sizeBytes: 13});
    expect(uploadCall?.[2]?.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects content that does not match the declared MIME/signature", async () => {
    blobMock.getPrivateBlobAsset.mockResolvedValueOnce({
      body: streamFor(new TextEncoder().encode("not a pdf")), contentType: "application/pdf", sizeBytes: 9
    });
    const response = await POST(request(), {params: Promise.resolve({recordId})});
    expect(response.status).toBe(400);
    expect(intakeMock.completeUpload).not.toHaveBeenCalled();
    expect(await response.text()).toContain('"INVALID_ASSET"');
  });
});
