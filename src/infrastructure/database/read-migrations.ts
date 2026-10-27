import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { EmbeddedMigration } from "./apply-migrations";

const STATEMENT_BREAKPOINT = "--> statement-breakpoint";

const journalSchema = z.object({
  entries: z.array(z.object({ tag: z.string(), when: z.number(), breakpoints: z.boolean() })),
});

export const MIGRATIONS_FOLDER = join(process.cwd(), "src", "infrastructure", "database", "migrations");

export function readMigrations(folder: string = MIGRATIONS_FOLDER): EmbeddedMigration[] {
  const journal = journalSchema.parse(
    JSON.parse(readFileSync(join(folder, "meta", "_journal.json"), "utf8")),
  );
  return journal.entries.map((entry) => {
    const query = readFileSync(join(folder, `${entry.tag}.sql`), "utf8");
    return {
      tag: entry.tag,
      sql: query.split(STATEMENT_BREAKPOINT),
      bps: entry.breakpoints,
      folderMillis: entry.when,
      hash: createHash("sha256").update(query).digest("hex"),
    };
  });
}
