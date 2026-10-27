import { desc, sql } from "drizzle-orm";
import { bigint, pgSchema, serial, text, type PgDatabase, type PgQueryResultHKT } from "drizzle-orm/pg-core";
import embedded from "./embedded-migrations.json";

export type EmbeddedMigration = {
  tag: string;
  sql: string[];
  bps: boolean;
  folderMillis: number;
  hash: string;
};

export const EMBEDDED_MIGRATIONS: EmbeddedMigration[] = embedded;

const migrationsTable = pgSchema("drizzle").table("__drizzle_migrations", {
  id: serial("id").primaryKey(),
  hash: text("hash").notNull(),
  createdAt: bigint("created_at", { mode: "number" }),
});

export async function applyMigrations(
  db: PgDatabase<PgQueryResultHKT>,
  migrations: EmbeddedMigration[] = EMBEDDED_MIGRATIONS,
): Promise<void> {
  await db.execute(sql`create schema if not exists "drizzle"`);
  await db.execute(
    sql`create table if not exists "drizzle"."__drizzle_migrations" (id serial primary key, hash text not null, created_at bigint)`,
  );
  const [last] = await db
    .select({ createdAt: migrationsTable.createdAt })
    .from(migrationsTable)
    .orderBy(desc(migrationsTable.createdAt))
    .limit(1);
  const pending = migrations.filter(
    (migration) => !last?.createdAt || last.createdAt < migration.folderMillis,
  );
  if (pending.length === 0) return;
  await db.transaction(async (tx) => {
    for (const migration of pending) {
      for (const statement of migration.sql) {
        if (statement.trim()) await tx.execute(sql.raw(statement));
      }
      await tx.insert(migrationsTable).values({ hash: migration.hash, createdAt: migration.folderMillis });
    }
  });
}
