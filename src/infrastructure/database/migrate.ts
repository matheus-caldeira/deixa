import { join } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { openDatabase } from "./client";

const MIGRATIONS_FOLDER = join(process.cwd(), "src", "infrastructure", "database", "migrations");
const DUPLICATE_DATABASE = "42P04";
const MISSING_DATABASE = "3D000";
const CONNECT_TIMEOUT_SECONDS = 5;

export async function ensureDatabaseExists(url: string): Promise<void> {
  const target = new URL(url);
  const databaseName = decodeURIComponent(target.pathname.slice(1));
  if (!/^[a-z0-9_]+$/.test(databaseName)) throw new Error("invalid database name");
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = postgres(admin.toString(), {
    max: 1,
    connect_timeout: CONNECT_TIMEOUT_SECONDS,
    onnotice: () => undefined,
  });
  try {
    const known = await client`select 1 from pg_database where datname = ${databaseName}`;
    if (known.length === 0) await client.unsafe(`CREATE DATABASE ${databaseName}`);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== DUPLICATE_DATABASE && code !== MISSING_DATABASE) throw error;
  } finally {
    await client.end({ timeout: 5 });
  }
}

export async function runMigrations(url: string): Promise<void> {
  await ensureDatabaseExists(url);
  const handle = openDatabase(url);
  try {
    await migrate(handle.db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await handle.close();
  }
}
