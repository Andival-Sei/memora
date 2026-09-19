import {describe, expect, it, vi} from "vitest";
import {
  createDocumentService,
  DocumentValidationError,
  type DocumentRepository,
  validateDocumentUpload
} from "./documents";

const pdfBytes = new TextEncoder().encode("%PDF-1.7\nbody").buffer;

describe("document upload policy", () => {
  it("accepts a PDF with a valid MIME and magic header", () => {
    expect(validateDocumentUpload({
      filename: "passport.pdf",
      contentType: "application/pdf",
      size: pdfBytes.byteLength,
      bytes: pdfBytes
    })).toEqual({
      filename: "passport.pdf",
      contentType: "application/pdf",
      size: pdfBytes.byteLength
    });
  });

  it("normalizes path separators and control characters in a filename", () => {
    expect(validateDocumentUpload({
      filename: "..\\passport\u0000.pdf",
      contentType: "application/pdf",
      size: pdfBytes.byteLength,
      bytes: pdfBytes
    }).filename).toBe("passport.pdf");
  });

  it("rejects MIME and magic-byte mismatches with stable codes", () => {
    expect(() => validateDocumentUpload({
      filename: "notes.pdf",
      contentType: "text/plain",
      size: pdfBytes.byteLength,
      bytes: pdfBytes
    })).toThrowError(new DocumentValidationError("DOCUMENT_UNSUPPORTED_TYPE"));

    expect(() => validateDocumentUpload({
      filename: "notes.pdf",
      contentType: "application/pdf",
      size: 7,
      bytes: new TextEncoder().encode("not pdf!").buffer
    })).toThrowError(new DocumentValidationError("DOCUMENT_INVALID_MAGIC_BYTES"));
  });

  it("enforces the ten MiB quota before provider work", () => {
    expect(() => validateDocumentUpload({
      filename: "large.pdf",
      contentType: "application/pdf",
      size: 10 * 1024 * 1024 + 1,
      bytes: pdfBytes
    })).toThrowError(new DocumentValidationError("DOCUMENT_FILE_TOO_LARGE"));
  });
});

describe("document service", () => {
  it("creates a scoped document and never returns the private blob path", async () => {
    const repository = {
      ensurePersonalVault: vi.fn().mockResolvedValue({vaultId: "vault-1"}),
      createDocument: vi.fn((input: Parameters<DocumentRepository["createDocument"]>[0]) => Promise.resolve({
        ...input,
        status: "ready" as const,
        createdAt: new Date("2026-09-19T00:00:00.000Z")
      })),
      listDocuments: vi.fn(),
      findDocument: vi.fn(),
      recordAudit: vi.fn().mockResolvedValue(undefined)
    };
    const blobStore = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined)
    };
    const service = createDocumentService({
      repository,
      blobStore,
      createId: () => "document-1"
    });

    const result = await service.upload("user_123", {
      filename: "passport.pdf",
      contentType: "application/pdf",
      size: pdfBytes.byteLength,
      bytes: pdfBytes
    });

    expect(repository.ensurePersonalVault).toHaveBeenCalledWith("user_123");
    expect(blobStore.put).toHaveBeenCalledWith(
      "vaults/vault-1/documents/document-1.pdf",
      pdfBytes,
      "application/pdf"
    );
    expect(result).toEqual({
      id: "document-1",
      filename: "passport.pdf",
      contentType: "application/pdf",
      sizeBytes: pdfBytes.byteLength,
      status: "ready",
      createdAt: "2026-09-19T00:00:00.000Z"
    });
    expect(result).not.toHaveProperty("blobPath");
  });

  it("removes the newly-created blob if metadata persistence fails", async () => {
    const repository = {
      ensurePersonalVault: vi.fn().mockResolvedValue({vaultId: "vault-1"}),
      createDocument: vi.fn().mockRejectedValue(new Error("db down")),
      listDocuments: vi.fn(),
      findDocument: vi.fn(),
      recordAudit: vi.fn().mockResolvedValue(undefined)
    };
    const blobStore = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined)
    };
    const service = createDocumentService({repository, blobStore, createId: () => "document-2"});

    await expect(service.upload("user_123", {
      filename: "passport.pdf",
      contentType: "application/pdf",
      size: pdfBytes.byteLength,
      bytes: pdfBytes
    })).rejects.toMatchObject({code: "DOCUMENT_UPLOAD_FAILED"});
    expect(blobStore.delete).toHaveBeenCalledWith("vaults/vault-1/documents/document-2.pdf");
    expect(repository.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      vaultId: "vault-1",
      action: "upload",
      result: "failure"
    }));
  });
});
