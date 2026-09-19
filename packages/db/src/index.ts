import {attachDatabasePool} from "@vercel/functions";
import {drizzle} from "drizzle-orm/node-postgres";
import {Pool} from "pg";
import * as schema from "./schema";

let pool: Pool | undefined;
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  if (!pool) {
    pool = new Pool({connectionString, max: 10});
    attachDatabasePool(pool);
    database = drizzle(pool, {schema});
  }
  return database!;
}

export {schema};
