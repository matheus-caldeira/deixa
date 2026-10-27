import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { MIGRATIONS_FOLDER, readMigrations } from "../src/infrastructure/database/read-migrations";

const target = join(MIGRATIONS_FOLDER, "..", "embedded-migrations.json");
writeFileSync(target, `${JSON.stringify(readMigrations(), null, 2)}\n`);
console.info(`embedded migrations written to ${target}`);
