import {beforeEach, describe, expect, it, vi} from "vitest";

const {authMock, intakeMock} = vi.hoisted(() => ({authMock: vi.fn(), intakeMock: {createUploadTicket: vi.fn()}}));
vi.mock("@clerk/nextjs/server", () => ({auth: authMock}));
vi.mock("@/lib/document-records/service", () => ({getDocumentRecordIntake: () => intakeMock}));

import {POST} from "./route";

const params = Promise.resolve({recordId: "11111111-1111-4111-8111-111111111111"});
function request(body: unknown) {
  return new Request("https://memora.example/api/document-records/id/upload-ticket", {
    method: "POST", headers: {origin: "https://memora.example", "content-type": "application/json"}, body: JSON.stringify(body)
  });
}

describe("typed record upload ticket route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({userId: "clerk-user-1"});
    intakeMock.createUploadTicket.mockResolvedValue({
      pathname: "vaults/vault-1/document-records/11111111-1111-4111-8111-111111111111/page-1.jpg",
      contentType: "image/jpeg", maximumSizeInBytes: 10 * 1024 * 1024
    });
  });

  it("checks auth, origin and type before returning a private ticket without URL", async () => {
    const response = await POST(request({contentType: "image/jpeg"}), {params});
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body: unknown = await response.json();
    expect(body).toMatchObject({ticket: {contentType: "image/jpeg", maximumSizeInBytes: 10 * 1024 * 1024}});
    expect(JSON.stringify(body)).not.toContain("https://");
    expect(intakeMock.createUploadTicket).toHaveBeenCalledWith("clerk-user-1", expect.any(String), "image/jpeg");

    const invalid = await POST(request({contentType: "image/gif"}), {params});
    expect(invalid.status).toBe(400);
    expect(intakeMock.createUploadTicket).toHaveBeenCalledTimes(1);
  });

  it("denies unauthenticated or cross-origin upload-ticket requests", async () => {
    authMock.mockResolvedValueOnce({userId: null});
    expect((await POST(request({contentType: "image/jpeg"}), {params})).status).toBe(401);
    const crossOrigin = new Request("https://memora.example/api/document-records/id/upload-ticket", {
      method: "POST", headers: {origin: "https://attacker.example", "content-type": "application/json"}, body: JSON.stringify({contentType: "image/jpeg"})
    });
    expect((await POST(crossOrigin, {params})).status).toBe(403);
    expect(intakeMock.createUploadTicket).not.toHaveBeenCalled();
  });
});
