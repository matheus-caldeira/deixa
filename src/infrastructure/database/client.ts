import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
export type DatabaseHandle = { db: Database; close: () => Promise<void> };

const MAX_CONNECTIONS = 10;
const CONNECT_TIMEOUT_SECONDS = 5;

export function openDatabase(url: string): DatabaseHandle {
  const client = postgres(url, {
    max: MAX_CONNECTIONS,
    connect_timeout: CONNECT_TIMEOUT_SECONDS,
    onnotice: () => undefined,
  });
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) };
}
