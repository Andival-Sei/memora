import {describe, expect, it} from "vitest";
import {
  createDocumentRecordService,
  DocumentRecordError,
  listDocumentTypeDefinitions,
  transitionDocumentRecordStatus,
  type DocumentRecordRepository,
  type DocumentRecordScope,
  type PersistedDocumentAsset,
  type PersistedDocumentRecord,
  type NewDocumentRecordAsset
} from "./document-records";

const scope = {actorId: "user_1", vaultId: "vault_1"};
const otherScope = {actorId: "user_2", vaultId: "vault_2"};

function createRepository(): DocumentRecordRepository {
  const records = new Map<string, PersistedDocumentRecord>();
  const assets = new Map<string, PersistedDocumentAsset[]>();
  return {
    createRecord(input) {
      const record = {...input, createdAt: new Date("2026-09-19T00:00:00.000Z"), updatedAt: new Date("2026-09-19T00:00:00.000Z")};
      records.set(record.id, record);
      assets.set(record.id, []);
      return Promise.resolve(record);
    },
    getRecord(requestedScope: DocumentRecordScope, recordId: string) {
      const record = records.get(recordId);
      if (!record || record.vaultId !== requestedScope.vaultId) return Promise.resolve(null);
      return Promise.resolve(record);
    },
    listAssets(requestedScope: DocumentRecordScope, recordId: string) {
      const record = records.get(recordId);
      return Promise.resolve(record?.vaultId === requestedScope.vaultId ? [...(assets.get(recordId) ?? [])] : []);
    },
    appendAssets(requestedScope: DocumentRecordScope, recordId: string, newAssets: readonly PersistedDocumentAsset[]) {
      const record = records.get(recordId);
      if (!record || record.vaultId !== requestedScope.vaultId) return Promise.resolve();
      const current = assets.get(recordId) ?? [];
      assets.set(recordId, [...current, ...newAssets]);
      return Promise.resolve();
    }
  };
}

function asset(hash: string): NewDocumentRecordAsset {
  return {
    blobPath: `vaults/vault_1/records/asset-${hash}.jpg`,
    contentType: "image/jpeg" as const,
    sizeBytes: 100,
    sha256: hash,
    width: 1200,
    height: 800
  };
}

describe("document type registry", () => {
  it("exposes versioned passport schemas for all first-release types", () => {
    const types = listDocumentTypeDefinitions();
    expect(types.map((type) => type.id)).toEqual([
      "ru-passport",
      "international-passport",
      "drivers-license",
      "tax-or-insurance",
      "birth-certificate",
      "medical-policy",
      "contract",
      "other"
    ]);
    const passport = types.find((type) => type.id === "ru-passport");
    expect(passport?.schemaVersion).toBe(1);
    expect(passport?.acceptedContentTypes).toEqual(expect.arrayContaining([
      "image/jpeg",
      "image/png",
      "application/pdf"
    ]));
    expect(passport?.fields.map((field) => field.key)).toEqual(expect.arrayContaining([
      "series",
      "number",
      "birthDate"
    ]));
  });
});

describe("document record intake", () => {
  it("creates a typed record and appends ordered multi-page assets without private fields", async () => {
    const repository = createRepository();
    const service = createDocumentRecordService({repository, createId: (prefix) => `${prefix}-1`});

    const record = await service.createRecord(scope, {documentType: "ru-passport"});
    const workspace = await service.addAssets(scope, {
      recordId: record.id,
      assets: [asset("a".repeat(64)), asset("b".repeat(64))]
    });

    expect(record).toMatchObject({documentType: "ru-passport", schemaVersion: 1, status: "empty", assetCount: 0});
    expect(workspace.assets.map((item) => item.pageIndex)).toEqual([0, 1]);
    expect(workspace.assets.map((item) => item.contentType)).toEqual(["image/jpeg", "image/jpeg"]);
    expect(workspace).not.toHaveProperty("blobPath");
    expect(workspace.assets[0]).not.toHaveProperty("sha256");
  });

  it("is idempotent for a repeated SHA-256 and rejects more than five unique assets", async () => {
    const repository = createRepository();
    let nextId = 0;
    const service = createDocumentRecordService({repository, createId: (prefix) => `${prefix}-${++nextId}`});
    const record = await service.createRecord(scope, {documentType: "contract"});

    await service.addAssets(scope, {recordId: record.id, assets: [asset("a".repeat(64))]});
    const repeated = await service.addAssets(scope, {recordId: record.id, assets: [asset("a".repeat(64))]});
    expect(repeated.assets).toHaveLength(1);

    await service.addAssets(scope, {
      recordId: record.id,
      assets: ["b", "c", "d", "e"].map((value) => asset(value.repeat(64)))
    });
    await expect(service.addAssets(scope, {recordId: record.id, assets: [asset("f".repeat(64))]}))
      .rejects.toMatchObject({code: "ASSET_LIMIT_REACHED"});
  });

  it("does not reveal records across vaults and rejects invalid status transitions", async () => {
    const repository = createRepository();
    const service = createDocumentRecordService({repository, createId: (prefix) => `${prefix}-1`});
    const record = await service.createRecord(scope, {documentType: "other"});

    await expect(service.getWorkspace(otherScope, record.id)).resolves.toBeNull();
    await expect(service.addAssets(otherScope, {recordId: record.id, assets: [asset("a".repeat(64))]}))
      .rejects.toMatchObject({code: "RECORD_NOT_FOUND"});
    expect(() => transitionDocumentRecordStatus("empty", "needs_review"))
      .toThrowError(new DocumentRecordError("INVALID_STATUS_TRANSITION"));
    expect(transitionDocumentRecordStatus("empty", "processing")).toBe("processing");
  });
});
