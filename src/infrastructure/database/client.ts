import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;
export type DatabaseHandle = { db: Database; close: () => Promise<void> };

const MAX_CONNECTIONS = 10;

export function openDatabase(url: string): DatabaseHandle {
  const client = postgres(url, { max: MAX_CONNECTIONS, onnotice: () => undefined });
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) };
}
