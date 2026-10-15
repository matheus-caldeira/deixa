import { runMigrations } from "./migrate";

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ausente. Rode pnpm setup:env.");
  return url;
}

runMigrations(requireDatabaseUrl())
  .then(() => console.info("migrations applied"))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "falha ao migrar");
    process.exit(1);
  });
