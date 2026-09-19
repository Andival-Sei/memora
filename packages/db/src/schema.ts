import {bigint, date, index, integer, pgTable, text, timestamp, unique, uuid, varchar} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull(),
  createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).defaultNow().notNull()
}, (table) => [unique("users_clerk_id_unique").on(table.clerkId)]);

export const vaults = pgTable("vaults", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, {onDelete: "cascade"}),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).defaultNow().notNull()
}, (table) => [unique("vaults_owner_id_unique").on(table.ownerId)]);

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  vaultId: uuid("vault_id").notNull().references(() => vaults.id, {onDelete: "cascade"}),
  blobPath: text("blob_path").notNull(),
  originalFilename: varchar("original_filename", {length: 120}).notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: bigint("size_bytes", {mode: "number"}).notNull(),
  status: text("status").notNull().default("ready"),
  createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).defaultNow().notNull()
}, (table) => [
  unique("documents_blob_path_unique").on(table.blobPath),
  index("documents_vault_created_at_idx").on(table.vaultId, table.createdAt)
]);

export const documentAuditEvents = pgTable("document_audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  vaultId: uuid("vault_id").notNull().references(() => vaults.id, {onDelete: "cascade"}),
  documentId: uuid("document_id").references(() => documents.id, {onDelete: "cascade"}),
  actorClerkId: text("actor_clerk_id").notNull(),
  action: text("action").notNull(),
  result: text("result").notNull(),
  createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull()
}, (table) => [index("document_audit_vault_created_at_idx").on(table.vaultId, table.createdAt)]);

export const documentRecords = pgTable("document_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  vaultId: uuid("vault_id").notNull().references(() => vaults.id, {onDelete: "cascade"}),
  documentType: text("document_type").notNull(),
  schemaVersion: integer("schema_version").notNull(),
  status: text("status").notNull().default("empty"),
  title: text("title"),
  issuedAt: date("issued_at", {mode: "string"}),
  expiresAt: date("expires_at", {mode: "string"}),
  createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).defaultNow().notNull()
}, (table) => [
  index("document_records_vault_created_at_idx").on(table.vaultId, table.createdAt),
  index("document_records_vault_type_status_idx").on(table.vaultId, table.documentType, table.status)
]);

export const documentAssets = pgTable("document_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  recordId: uuid("record_id").notNull().references(() => documentRecords.id, {onDelete: "cascade"}),
  vaultId: uuid("vault_id").notNull().references(() => vaults.id, {onDelete: "cascade"}),
  blobPath: text("blob_path").notNull(),
  pageIndex: integer("page_index").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: bigint("size_bytes", {mode: "number"}).notNull(),
  width: integer("width"),
  height: integer("height"),
  sha256: varchar("sha256", {length: 64}).notNull(),
  qualityStatus: text("quality_status").notNull().default("unknown"),
  createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull()
}, (table) => [
  unique("document_assets_record_page_unique").on(table.recordId, table.pageIndex),
  unique("document_assets_record_sha256_unique").on(table.recordId, table.sha256),
  unique("document_assets_blob_path_unique").on(table.blobPath),
  index("document_assets_vault_record_page_idx").on(table.vaultId, table.recordId, table.pageIndex)
]);
