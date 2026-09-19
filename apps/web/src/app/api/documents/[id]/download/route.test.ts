import {beforeEach, describe, expect, it, vi} from "vitest";
import {auth} from "@clerk/nextjs/server";
import {type DocumentService} from "@memora/domain";
import {getDocumentService} from "../../../../../lib/documents/service";
import {GET} from "./route";

vi.mock("@clerk/nextjs/server", () => ({auth: vi.fn()}));
vi.mock("../../../../../lib/documents/service", () => ({getDocumentService: vi.fn()}));

describe("document download API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({userId: "user_123"} as never);
  });

  it("returns the same generic 404 for a missing or cross-tenant id", async () => {
    const service = {
      upload: vi.fn(),
      list: vi.fn(),
      download: vi.fn().mockResolvedValue(null)
    } satisfies DocumentService;
    vi.mocked(getDocumentService).mockReturnValue(service);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({id: "11111111-1111-4111-8111-111111111111"})
    });
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(service.download).toHaveBeenCalledWith("user_123", "11111111-1111-4111-8111-111111111111");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("streams the private content without redirect or cache", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("%PDF-"));
        controller.close();
      }
    });
    const service = {
      upload: vi.fn(),
      list: vi.fn(),
      download: vi.fn().mockResolvedValue({
        filename: "паспорт.pdf",
        contentType: "application/pdf" as const,
        sizeBytes: 5,
        body
      })
    } satisfies DocumentService;
    vi.mocked(getDocumentService).mockReturnValue(service);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({id: "11111111-1111-4111-8111-111111111111"})
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(response.headers.get("content-disposition")).toContain("filename*=UTF-8''");
    expect(await response.text()).toBe("%PDF-");
  });

  it("does not query the service for malformed ids or guests", async () => {
    const service = {upload: vi.fn(), list: vi.fn(), download: vi.fn()} satisfies DocumentService;
    vi.mocked(getDocumentService).mockReturnValue(service);
    const malformed = await GET(new Request("http://localhost"), {
      params: Promise.resolve({id: "not-a-uuid"})
    });
    expect(malformed.status).toBe(404);
    expect(service.download).not.toHaveBeenCalled();

    vi.mocked(auth).mockResolvedValue({userId: null} as never);
    const guest = await GET(new Request("http://localhost"), {
      params: Promise.resolve({id: "11111111-1111-4111-8111-111111111111"})
    });
    expect(guest.status).toBe(401);
    expect(getDocumentService).toHaveBeenCalledTimes(0);
  });
});
