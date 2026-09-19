import {beforeEach, describe, expect, it, vi} from "vitest";
import {DocumentServiceError, DocumentValidationError, type DocumentService} from "@memora/domain";
import {auth} from "@clerk/nextjs/server";
import {getDocumentService} from "../../../lib/documents/service";
import {GET, POST} from "./route";

vi.mock("@clerk/nextjs/server", () => ({auth: vi.fn()}));
vi.mock("../../../lib/documents/service", () => ({getDocumentService: vi.fn()}));

const validDocument = {
  id: "11111111-1111-4111-8111-111111111111",
  filename: "passport.pdf",
  contentType: "application/pdf" as const,
  sizeBytes: 12,
  status: "ready" as const,
  createdAt: "2026-09-19T00:00:00.000Z"
};

function makePdfRequest(file?: File): Request {
  const form = new FormData();
  if (file) form.set("file", file);
  return new Request("http://localhost/api/documents", {method: "POST", body: form});
}

describe("documents collection API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({userId: "user_123"} as never);
  });

  it("returns 401 for guests without invoking the use case", async () => {
    vi.mocked(auth).mockResolvedValue({userId: null} as never);
    const response = await POST(makePdfRequest());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({error: "Unauthorized"});
    expect(getDocumentService).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns a structured quota error before reading an oversized body", async () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf", {
      type: "application/pdf"
    });
    const response = await POST(makePdfRequest(file));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({error: {code: "DOCUMENT_FILE_TOO_LARGE"}});
    expect(getDocumentService).not.toHaveBeenCalled();
  });

  it("passes a validated file to the service and never returns private fields", async () => {
    const service = {
      upload: vi.fn().mockResolvedValue(validDocument),
      list: vi.fn(),
      download: vi.fn()
    } satisfies DocumentService;
    vi.mocked(getDocumentService).mockReturnValue(service);
    const response = await POST(makePdfRequest(new File(["%PDF-1.7"], "passport.pdf", {
      type: "application/pdf"
    })));

    expect(response.status).toBe(201);
    const payload: unknown = await response.json();
    expect(payload).toEqual({document: validDocument});
    expect(service.upload).toHaveBeenCalledWith("user_123", expect.objectContaining({
      filename: "passport.pdf",
      contentType: "application/pdf"
    }));
    expect(JSON.stringify(payload)).not.toContain("blobPath");
  });

  it("maps domain validation and provider failures to stable JSON errors", async () => {
    const service = {
      upload: vi.fn().mockRejectedValue(new DocumentValidationError("DOCUMENT_INVALID_MAGIC_BYTES")),
      list: vi.fn(),
      download: vi.fn()
    } satisfies DocumentService;
    vi.mocked(getDocumentService).mockReturnValue(service);
    const invalidResponse = await POST(makePdfRequest(new File(["not pdf"], "notes.pdf", {
      type: "application/pdf"
    })));
    expect(invalidResponse.status).toBe(400);
    expect(await invalidResponse.json()).toMatchObject({error: {code: "DOCUMENT_INVALID_MAGIC_BYTES"}});

    service.upload.mockRejectedValue(new DocumentServiceError());
    const providerResponse = await POST(makePdfRequest(new File(["%PDF-"], "notes.pdf", {
      type: "application/pdf"
    })));
    expect(providerResponse.status).toBe(500);
    expect(await providerResponse.json()).toMatchObject({error: {code: "DOCUMENT_UPLOAD_FAILED"}});
  });

  it("lists only public document metadata with no-store cache policy", async () => {
    const service = {
      upload: vi.fn(),
      list: vi.fn().mockResolvedValue([validDocument]),
      download: vi.fn()
    } satisfies DocumentService;
    vi.mocked(getDocumentService).mockReturnValue(service);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({documents: [validDocument]});
    expect(service.list).toHaveBeenCalledWith("user_123");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
