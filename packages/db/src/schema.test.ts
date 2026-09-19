import {getTableConfig} from "drizzle-orm/pg-core";
import {describe, expect, it} from "vitest";
import {users, vaults} from "./schema";

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
});
