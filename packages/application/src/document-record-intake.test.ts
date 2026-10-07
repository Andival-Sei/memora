import {describe, expect, it} from "vitest";
import type {DocumentAssetContentType, PublicDocumentRecordWorkspace} from "@memora/contracts";
import type {DocumentRecordService} from "@memora/domain";
import {createDocumentRecordIntake as createUseCase} from "./document-record-intake";

const recordId = "record_1";
const emptyWorkspace: PublicDocumentRecordWorkspace = {
  id: recordId,
  documentType: "ru-passport",
  schemaVersion: 1,
  status: "empty",
  title: null,
  issuedAt: null,
  expiresAt: null,
  assetCount: 0,
  createdAt: "2026-09-19T00:00:00.000Z",
  updatedAt: "2026-09-19T00:00:00.000Z",
  assets: []
};

function makeUseCase(workspace: PublicDocumentRecordWorkspace = emptyWorkspace) {
  const records: DocumentRecordService = {
    listRecords: () => Promise.resolve([workspace]),
    createRecord: () => Promise.resolve(workspace),
    getWorkspace: (scope, requestedId) => Promise.resolve(scope.vaultId === "vault_1" && requestedId === workspace.id ? workspace : null),
    addAssets: () => Promise.resolve(workspace),
    getPersistedAsset: () => Promise.resolve(null),
    hasAssetPath: () => Promise.resolve(false)
  };
  const intake = createUseCase({
    records,
    personalVaults: {ensurePersonalVault: (clerkId) => Promise.resolve({vaultId: clerkId === "owner" ? "vault_1" : "vault_2"})},
    createId: () => "ticket_1"
  });
  return {intake, records};
}

describe("document record intake use case", () => {
  it("issues a private, type-compatible ticket only for a record in the actor's vault", async () => {
    const {intake} = makeUseCase();

    await expect(intake.createUploadTicket("owner", recordId, "image/jpeg")).resolves.toEqual({
      pathname: "vaults/vault_1/document-records/record_1/ticket_1.jpg",
      contentType: "image/jpeg",
      maximumSizeInBytes: 10 * 1024 * 1024
    });
    await expect(intake.createUploadTicket("other", recordId, "image/jpeg"))
      .rejects.toMatchObject({code: "RECORD_NOT_FOUND"});
  });

  it("rejects a path outside the owner's vault and a file type not accepted by the document", async () => {
    const {intake} = makeUseCase({...emptyWorkspace, documentType: "other"});

    await expect(intake.authorizeUpload(
      "owner",
      recordId,
      "vaults/vault_2/document-records/record_1/ticket_1.pdf",
      "application/pdf"
    )).rejects.toMatchObject({code: "INVALID_ASSET"});
    await expect(intake.createUploadTicket("owner", recordId, "text/plain" as DocumentAssetContentType))
      .rejects.toMatchObject({code: "INVALID_ASSET"});
  });

  it("refuses to authorize another Blob upload after the record reaches its page limit", async () => {
    const fullWorkspace: PublicDocumentRecordWorkspace = {
      ...emptyWorkspace,
      assetCount: 5,
      assets: Array.from({length: 5}, (_, pageIndex) => ({
        id: `asset_${pageIndex + 1}`,
        pageIndex,
        contentType: "image/jpeg",
        sizeBytes: 128,
        width: null,
        height: null,
        qualityStatus: "unknown"
      }))
    };
    const {intake} = makeUseCase(fullWorkspace);

    await expect(intake.authorizeUpload(
      "owner",
      recordId,
      "vaults/vault_1/document-records/record_1/ticket_1.jpg",
      "image/jpeg"
    )).rejects.toMatchObject({code: "ASSET_LIMIT_REACHED"});
  });
});
