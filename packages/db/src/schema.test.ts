import {getTableConfig} from "drizzle-orm/pg-core";
import {describe, expect, it} from "vitest";
import {documentAssets, documentAuditEvents, documentRecords, documents, users, vaults} from "./schema";

describe("identity storage boundary", () => {
  it("uses stable UUID keys and unique Clerk identities", () => {
    const userConfig = getTableConfig(users);
    expect(userConfig.columns.find((column) => column.name === "id")?.primary).toBe(true);
    expect(userConfig.uniqueConstraints).toHaveLength(1);
  });

  it("requires every vault to have an owner", () => {
    const vaultConfig = getTableConfig(vaults);
    const owner = vaultConfig.columns.find((column) => column.name === "owner_id");
    expect(owner?.notNull).toBe(true);
    expect(vaultConfig.foreignKeys).toHaveLength(1);
  });

  it("keeps personal vaults unique and documents scoped to a vault", () => {
    const vaultConfig = getTableConfig(vaults);
    expect(vaultConfig.uniqueConstraints.map((constraint) => constraint.name)).toContain(
      "vaults_owner_id_unique"
    );

    const documentConfig = getTableConfig(documents);
    expect(documentConfig.columns.find((column) => column.name === "vault_id")?.notNull).toBe(true);
    expect(documentConfig.columns.find((column) => column.name === "blob_path")?.notNull).toBe(true);
    expect(documentConfig.uniqueConstraints.map((constraint) => constraint.name)).toContain(
      "documents_blob_path_unique"
    );
    expect(documentConfig.foreignKeys).toHaveLength(1);
  });

  it("stores audit events without document payload columns", () => {
    const auditConfig = getTableConfig(documentAuditEvents);
    expect(auditConfig.columns.map((column) => column.name)).toEqual(expect.arrayContaining([
      "vault_id",
      "document_id",
      "actor_clerk_id",
      "action",
      "result"
    ]));
    expect(auditConfig.columns.map((column) => column.name)).not.toContain("payload");
  });

  it("stores typed records and private multi-page assets with idempotency constraints", () => {
    const recordConfig = getTableConfig(documentRecords);
    expect(recordConfig.columns.find((column) => column.name === "vault_id")?.notNull).toBe(true);
    expect(recordConfig.columns.find((column) => column.name === "document_type")?.notNull).toBe(true);
    expect(recordConfig.columns.find((column) => column.name === "schema_version")?.notNull).toBe(true);
    expect(recordConfig.columns.find((column) => column.name === "status")?.notNull).toBe(true);
    expect(recordConfig.foreignKeys).toHaveLength(1);

    const assetConfig = getTableConfig(documentAssets);
    expect(assetConfig.columns.find((column) => column.name === "blob_path")?.notNull).toBe(true);
    expect(assetConfig.columns.find((column) => column.name === "sha256")?.notNull).toBe(true);
    expect(assetConfig.columns.find((column) => column.name === "page_index")?.notNull).toBe(true);
    expect(assetConfig.uniqueConstraints.map((constraint) => constraint.name)).toEqual(expect.arrayContaining([
      "document_assets_record_page_unique",
      "document_assets_record_sha256_unique",
      "document_assets_blob_path_unique"
    ]));
    expect(assetConfig.foreignKeys).toHaveLength(2);
  });
});
