import {pgTable, text, timestamp, unique, uuid} from "drizzle-orm/pg-core";

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
});
