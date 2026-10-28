import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, describe, expect, it } from "vitest";
import { applyMigrations, EMBEDDED_MIGRATIONS, pendingMigrations } from "./apply-migrations";

const OLD_RELEASE = 3;

describe("migrações pendentes no banco do navegador", () => {
  const client = new PGlite();
  const db = drizzle(client);
  afterAll(() => client.close());

  it("banco novo não pede cópia; banco de uma versão antiga pede", async () => {
    expect(await pendingMigrations(db)).toEqual({ pending: EMBEDDED_MIGRATIONS.length, fresh: true });
    await applyMigrations(db, EMBEDDED_MIGRATIONS.slice(0, OLD_RELEASE));
    expect(await pendingMigrations(db)).toEqual({
      pending: EMBEDDED_MIGRATIONS.length - OLD_RELEASE,
      fresh: false,
    });
    await applyMigrations(db);
    expect(await pendingMigrations(db)).toEqual({ pending: 0, fresh: false });
  });
});
