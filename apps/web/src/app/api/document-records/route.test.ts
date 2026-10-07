import {beforeEach, describe, expect, it, vi} from "vitest";

const {authMock, intakeMock} = vi.hoisted(() => ({authMock: vi.fn(), intakeMock: {
  list: vi.fn(), create: vi.fn()
}}));

vi.mock("@clerk/nextjs/server", () => ({auth: authMock}));
vi.mock("@/lib/document-records/service", () => ({getDocumentRecordIntake: () => intakeMock}));

import {GET, POST} from "./route";

const record = {
  id: "11111111-1111-4111-8111-111111111111", documentType: "ru-passport" as const, schemaVersion: 1,
  status: "empty" as const, title: null, issuedAt: null, expiresAt: null, assetCount: 0,
  createdAt: "2026-09-19T00:00:00.000Z", updatedAt: "2026-09-19T00:00:00.000Z"
};

function createRequest(body: unknown): Request {
  return new Request("https://memora.example/api/document-records", {
    method: "POST", headers: {origin: "https://memora.example", "content-type": "application/json"}, body: JSON.stringify(body)
  });
}

describe("document records collection routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({userId: "clerk-user-1"});
    intakeMock.list.mockResolvedValue([record]);
    intakeMock.create.mockResolvedValue(record);
  });

  it("returns only the application DTO with private no-store headers", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({records: [record]});
    expect(intakeMock.list).toHaveBeenCalledWith("clerk-user-1");
  });

  it("requires authentication and a same-origin strict typed create request", async () => {
    authMock.mockResolvedValueOnce({userId: null});
    const unauthorized = await POST(createRequest({documentType: "ru-passport"}));
    expect(unauthorized.status).toBe(401);

    const rejected = await POST(createRequest({documentType: "ru-passport", vaultId: "attacker"}));
    expect(rejected.status).toBe(400);
    expect(intakeMock.create).not.toHaveBeenCalled();

    const valid = await POST(createRequest({documentType: "ru-passport"}));
    expect(valid.status).toBe(201);
    expect(await valid.json()).toEqual({record});
    expect(intakeMock.create).toHaveBeenCalledWith("clerk-user-1", {documentType: "ru-passport"});
  });

  it("rejects a cross-origin write", async () => {
    const request = new Request("https://memora.example/api/document-records", {
      method: "POST", headers: {origin: "https://attacker.example", "content-type": "application/json"}, body: JSON.stringify({documentType: "ru-passport"})
    });
    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(intakeMock.create).not.toHaveBeenCalled();
  });
});
