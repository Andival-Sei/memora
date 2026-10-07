import {describe, expect, it} from "vitest";
import {
  documentRecordCreateInputSchema,
  documentRecordFinalizeAssetRequestSchema,
  documentRecordListResponseSchema,
  documentRecordUploadTicketRequestSchema,
  documentRecordUploadTicketResponseSchema,
  documentRecordWorkspaceResponseSchema
} from "./document-records";

describe("document record HTTP contracts", () => {
  it("rejects client-supplied ownership and limits tickets to safe internal paths", () => {
    expect(documentRecordCreateInputSchema.safeParse({documentType: "ru-passport", vaultId: "other"}).success).toBe(false);
    expect(documentRecordUploadTicketRequestSchema.safeParse({contentType: "image/jpeg", actorId: "user"}).success).toBe(false);
    expect(documentRecordUploadTicketResponseSchema.safeParse({ticket: {
      pathname: "https://blob.example/private.jpg",
      contentType: "image/jpeg",
      maximumSizeInBytes: 100
    }}).success).toBe(false);
    expect(documentRecordFinalizeAssetRequestSchema.safeParse({pathname: "../outside.pdf", contentType: "application/pdf"}).success).toBe(false);
  });

  it("validates vault-scoped records, workspaces and upload tickets", () => {
    const record = {
      id: "record-1",
      documentType: "ru-passport",
      schemaVersion: 1,
      status: "empty",
      title: null,
      issuedAt: null,
      expiresAt: null,
      assetCount: 0,
      createdAt: "2026-09-19T00:00:00.000Z",
      updatedAt: "2026-09-19T00:00:00.000Z"
    } as const;
    expect(documentRecordListResponseSchema.safeParse({records: [record]}).success).toBe(true);
    expect(documentRecordWorkspaceResponseSchema.safeParse({workspace: {...record, assets: []}}).success).toBe(true);
    expect(documentRecordUploadTicketResponseSchema.safeParse({ticket: {
      pathname: "vaults/vault-1/document-records/record-1/page-1.jpg",
      contentType: "image/jpeg",
      maximumSizeInBytes: 10 * 1024 * 1024
    }}).success).toBe(true);
    expect(documentRecordFinalizeAssetRequestSchema.safeParse({
      pathname: "vaults/vault-1/document-records/record-1/page-1.jpg", contentType: "image/jpeg"
    }).success).toBe(true);
  });
});
