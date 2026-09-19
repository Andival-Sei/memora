import {and, asc, eq} from "drizzle-orm";
import type {
  DocumentRecordRepository,
  DocumentRecordScope,
  PersistedDocumentAsset,
  PersistedDocumentRecord
} from "@memora/domain";
import {getDb} from "./index";
import {documentAssets, documentRecords} from "./schema";

type Database = ReturnType<typeof getDb>;

function mapRecord(row: typeof documentRecords.$inferSelect): PersistedDocumentRecord {
  return {
    id: row.id,
    vaultId: row.vaultId,
    documentType: row.documentType as PersistedDocumentRecord["documentType"],
    schemaVersion: row.schemaVersion,
    status: row.status as PersistedDocumentRecord["status"],
    title: row.title,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapAsset(row: typeof documentAssets.$inferSelect): PersistedDocumentAsset {
  return {
    id: row.id,
    recordId: row.recordId,
    vaultId: row.vaultId,
    blobPath: row.blobPath,
    pageIndex: row.pageIndex,
    contentType: row.contentType as PersistedDocumentAsset["contentType"],
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    sha256: row.sha256,
    qualityStatus: row.qualityStatus as PersistedDocumentAsset["qualityStatus"],
    createdAt: row.createdAt
  };
}

export function createDocumentRecordRepository(database?: Database): DocumentRecordRepository {
  const db = database ?? getDb();

  return {
    async createRecord(input) {
      const [row] = await db.insert(documentRecords).values({
        id: input.id,
        vaultId: input.vaultId,
        documentType: input.documentType,
        schemaVersion: input.schemaVersion,
        status: input.status,
        title: input.title,
        issuedAt: input.issuedAt,
        expiresAt: input.expiresAt
      }).returning();
      if (!row) throw new Error("Unable to persist document record");
      return mapRecord(row);
    },

    async getRecord(scope: DocumentRecordScope, recordId) {
      const [row] = await db
        .select()
        .from(documentRecords)
        .where(and(eq(documentRecords.vaultId, scope.vaultId), eq(documentRecords.id, recordId)))
        .limit(1);
      return row ? mapRecord(row) : null;
    },

    async listAssets(scope: DocumentRecordScope, recordId) {
      const rows = await db
        .select()
        .from(documentAssets)
        .where(and(eq(documentAssets.vaultId, scope.vaultId), eq(documentAssets.recordId, recordId)))
        .orderBy(asc(documentAssets.pageIndex));
      return rows.map(mapAsset);
    },

    async appendAssets(scope: DocumentRecordScope, recordId, assets) {
      if (assets.length === 0) return;
      const [record] = await db
        .select({id: documentRecords.id})
        .from(documentRecords)
        .where(and(eq(documentRecords.vaultId, scope.vaultId), eq(documentRecords.id, recordId)))
        .limit(1);
      if (!record) throw new Error("Unable to resolve document record");
      await db.insert(documentAssets).values(assets.map((asset) => ({
        id: asset.id,
        recordId,
        vaultId: scope.vaultId,
        blobPath: asset.blobPath,
        pageIndex: asset.pageIndex,
        contentType: asset.contentType,
        sizeBytes: asset.sizeBytes,
        width: asset.width,
        height: asset.height,
        sha256: asset.sha256,
        qualityStatus: asset.qualityStatus,
        createdAt: asset.createdAt
      }))).onConflictDoNothing({target: [documentAssets.recordId, documentAssets.sha256]});
    }
  };
}
