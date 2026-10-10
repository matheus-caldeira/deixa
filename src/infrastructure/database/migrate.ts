import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { openDatabase } from "./client";

const MIGRATIONS_FOLDER = fileURLToPath(new URL("./migrations", import.meta.url));
const DUPLICATE_DATABASE = "42P04";

export async function ensureDatabaseExists(url: string): Promise<void> {
  const target = new URL(url);
  const databaseName = decodeURIComponent(target.pathname.slice(1));
  if (!/^[a-z0-9_]+$/.test(databaseName)) throw new Error("nome de banco inválido");
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = postgres(admin.toString(), { max: 1, onnotice: () => undefined });
  try {
    await client.unsafe(`CREATE DATABASE ${databaseName}`);
  } catch (error) {
    if ((error as { code?: string }).code !== DUPLICATE_DATABASE) throw error;
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
