import postgres from "postgres";
import { openDatabase, type DatabaseHandle } from "./client";
import { runMigrations } from "./migrate";
import { openPgliteDatabase } from "./pglite-client";

const DEFAULT_URL = "postgres://deixa:deixa@localhost:1442/deixa";

export const usesPglite = process.env.TEST_DATABASE_DRIVER === "pglite";
export const testDatabaseAvailable = usesPglite || Boolean(process.env.DATABASE_URL);

export function testDatabaseUrl(name: string): string {
  const url = new URL(process.env.DATABASE_URL ?? DEFAULT_URL);
  url.pathname = `/${name}`;
  return url.toString();
}

async function recreatePostgresDatabase(name: string): Promise<string> {
  const url = testDatabaseUrl(name);
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = postgres(admin.toString(), { max: 1, onnotice: () => undefined });
  try {
    await client.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  } finally {
    await client.end({ timeout: 5 });
  }
  await runMigrations(url);
  return url;
}

export async function openTestDatabase(name: string): Promise<DatabaseHandle & { url: string }> {
  if (usesPglite) return { ...(await openPgliteDatabase()), url: testDatabaseUrl(name) };
  const url = await recreatePostgresDatabase(name);
  return { ...openDatabase(url), url };
}
