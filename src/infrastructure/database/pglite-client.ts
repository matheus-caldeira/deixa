import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "./apply-migrations";
import type { DatabaseHandle } from "./client";
import * as schema from "./schema";

export async function openPgliteDatabase(dataDir?: string): Promise<DatabaseHandle> {
  const client = await PGlite.create(dataDir);
  await applyMigrations(drizzle(client));
  return { db: drizzle(client, { schema }), close: () => client.close() };
}
