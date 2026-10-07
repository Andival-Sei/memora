import {beforeEach, describe, expect, it, vi} from "vitest";

const {authMock, intakeMock} = vi.hoisted(() => ({authMock: vi.fn(), intakeMock: {getWorkspace: vi.fn()}}));
vi.mock("@clerk/nextjs/server", () => ({auth: authMock}));
vi.mock("@/lib/document-records/service", () => ({getDocumentRecordIntake: () => intakeMock}));

import {GET} from "./route";

const recordId = "11111111-1111-4111-8111-111111111111";
const workspace = {
  id: recordId, documentType: "ru-passport" as const, schemaVersion: 1, status: "needs_review" as const,
  title: null, issuedAt: null, expiresAt: null, assetCount: 1,
  createdAt: "2026-09-19T00:00:00.000Z", updatedAt: "2026-09-19T00:00:00.000Z",
  assets: [{id: "asset-1", pageIndex: 0, contentType: "image/jpeg" as const, sizeBytes: 42,
    width: 10, height: 10, qualityStatus: "unknown" as const}]
};

describe("typed record workspace route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({userId: "clerk-user-1"});
    intakeMock.getWorkspace.mockResolvedValue(workspace);
  });

  it("returns a private, vault-scoped DTO without storage internals", async () => {
    const response = await GET(new Request(`https://memora.example/api/document-records/${recordId}`), {
      params: Promise.resolve({recordId})
    });
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(text).toContain("needs_review");
    expect(text).not.toContain("blobPath");
    expect(text).not.toContain("vaultId");
    expect(text).not.toContain("sha256");
    expect(intakeMock.getWorkspace).toHaveBeenCalledWith("clerk-user-1", recordId);
  });

  it("rejects anonymous requests and hides missing owner-scoped records", async () => {
    authMock.mockResolvedValueOnce({userId: null});
    expect((await GET(new Request("https://memora.example"), {params: Promise.resolve({recordId})})).status).toBe(401);
    intakeMock.getWorkspace.mockResolvedValueOnce(null);
    const missing = await GET(new Request("https://memora.example"), {params: Promise.resolve({recordId})});
    expect(missing.status).toBe(404);
  });
});
