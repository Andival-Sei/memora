import {and, desc, eq} from "drizzle-orm";
import type {DocumentRepository, PersistedDocument} from "@memora/domain";
import {getDb} from "./index";
import {documentAuditEvents, documents, users, vaults} from "./schema";

type Database = ReturnType<typeof getDb>;

function mapDocument(row: typeof documents.$inferSelect): PersistedDocument {
  if (row.status !== "ready") throw new Error("Unsupported document status");
  return {
    id: row.id,
    vaultId: row.vaultId,
    blobPath: row.blobPath,
    originalFilename: row.originalFilename,
    contentType: "application/pdf",
    sizeBytes: row.sizeBytes,
    status: "ready",
    createdAt: row.createdAt
  };
}

export function createDocumentRepository(database?: Database): DocumentRepository {
  const db = database ?? getDb();

  return {
    async ensurePersonalVault(clerkId) {
      return db.transaction(async (transaction) => {
        const [user] = await transaction
          .insert(users)
          .values({clerkId})
          .onConflictDoUpdate({
            target: users.clerkId,
            set: {updatedAt: new Date()}
          })
          .returning({id: users.id});
        if (!user) throw new Error("Unable to resolve identity");

        const [existing] = await transaction
          .select({id: vaults.id})
          .from(vaults)
          .where(eq(vaults.ownerId, user.id))
          .limit(1);
        if (existing) return {vaultId: existing.id};

        const [created] = await transaction
          .insert(vaults)
          .values({ownerId: user.id, name: "Personal vault"})
          .onConflictDoNothing({target: vaults.ownerId})
          .returning({id: vaults.id});
        if (created) return {vaultId: created.id};

        const [raced] = await transaction
          .select({id: vaults.id})
          .from(vaults)
          .where(eq(vaults.ownerId, user.id))
          .limit(1);
        if (!raced) throw new Error("Unable to resolve personal vault");
        return {vaultId: raced.id};
      });
    },

    async createDocument(input) {
      const [row] = await db.insert(documents).values({
        id: input.id,
        vaultId: input.vaultId,
        blobPath: input.blobPath,
        originalFilename: input.originalFilename,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        status: "ready"
      }).returning();
      if (!row) throw new Error("Unable to persist document");
      return mapDocument(row);
    },

    async listDocuments(vaultId) {
      const rows = await db
        .select()
        .from(documents)
        .where(eq(documents.vaultId, vaultId))
        .orderBy(desc(documents.createdAt))
        .limit(100);
      return rows.map(mapDocument);
    },

    async findDocument(vaultId, documentId) {
      const [row] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.vaultId, vaultId), eq(documents.id, documentId)))
        .limit(1);
      return row ? mapDocument(row) : null;
    },

    async recordAudit(input) {
      const values: typeof documentAuditEvents.$inferInsert = {
        vaultId: input.vaultId,
        actorClerkId: input.actorClerkId,
        action: input.action,
        result: input.result
      };
      if (input.documentId) values.documentId = input.documentId;
      await db.insert(documentAuditEvents).values(values);
    }
  };
}
