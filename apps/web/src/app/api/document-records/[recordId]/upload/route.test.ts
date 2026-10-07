import {beforeEach, describe, expect, it, vi} from "vitest";

const {authMock, intakeMock, handleUploadMock} = vi.hoisted(() => ({
  authMock: vi.fn(),
  intakeMock: {authorizeUpload: vi.fn()},
  handleUploadMock: vi.fn()
}));
vi.mock("@clerk/nextjs/server", () => ({auth: authMock}));
vi.mock("@vercel/blob/client", () => ({handleUpload: handleUploadMock}));
vi.mock("@/lib/document-records/service", () => ({getDocumentRecordIntake: () => intakeMock}));

import {POST} from "./route";

const recordId = "11111111-1111-4111-8111-111111111111";
const pathname = `vaults/vault-1/document-records/${recordId}/page-1.jpg`;
const params = Promise.resolve({recordId});
function createRequest() {
  return new Request(`https://memora.example/api/document-records/${recordId}/upload`, {
    method: "POST", headers: {origin: "https://memora.example", "content-type": "application/json"}, body: JSON.stringify({type: "blob.generate-client-token"})
  });
}

describe("private Blob token route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({userId: "clerk-user-1"});
    intakeMock.authorizeUpload.mockResolvedValue(undefined);
    handleUploadMock.mockImplementation(async (options: unknown) => {
      const callback = (options as {onBeforeGenerateToken: (path: string, payload: string) => Promise<unknown>}).onBeforeGenerateToken;
      return callback(pathname, JSON.stringify({contentType: "image/jpeg"}));
    });
  });

  it("mints constraints only after Clerk and record-path ownership checks", async () => {
    const response = await POST(createRequest(), {params});
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      allowedContentTypes: ["image/jpeg"], maximumSizeInBytes: 10 * 1024 * 1024,
      addRandomSuffix: false, allowOverwrite: false, cacheControlMaxAge: 0
    });
    expect(intakeMock.authorizeUpload).toHaveBeenCalledWith("clerk-user-1", recordId, pathname, "image/jpeg");
  });

  it("does not invoke Blob token exchange for unauthenticated or cross-origin requests", async () => {
    authMock.mockResolvedValueOnce({userId: null});
    expect((await POST(createRequest(), {params})).status).toBe(401);
    const crossOrigin = new Request(`https://memora.example/api/document-records/${recordId}/upload`, {
      method: "POST", headers: {origin: "https://attacker.example", "content-type": "application/json"}, body: "{}"
    });
    expect((await POST(crossOrigin, {params})).status).toBe(403);
    expect(handleUploadMock).not.toHaveBeenCalled();
  });
});
