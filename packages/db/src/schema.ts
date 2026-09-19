import {bigint, index, pgTable, text, timestamp, unique, uuid, varchar} from "drizzle-orm/pg-core";

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
