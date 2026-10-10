import { rm } from "node:fs/promises";
import postgres from "postgres";
import { parseEnv } from "@/infrastructure/config/env";
import { buildContainer } from "@/infrastructure/container";
import { openDatabase } from "@/infrastructure/database/client";
import { runMigrations } from "@/infrastructure/database/migrate";
import { silentLogger } from "@/infrastructure/logger/logger";
import { DrizzleCatalogRepository } from "@/modules/catalog/infrastructure/drizzle-catalog-repository";
import { FakeLlmProvider } from "@/modules/learning/infrastructure/fake-llm-provider";
import { runSeed } from "@/seed/run-seed";
import { E2E_DATA_DIR, e2eEnvironment } from "./environment";

async function dropDatabase(url: string): Promise<void> {
  const target = new URL(url);
  const name = target.pathname.slice(1);
  if (name !== "deixa_e2e") throw new Error("o e2e só recria o banco deixa_e2e");
  target.pathname = "/postgres";
  const admin = postgres(target.toString(), { max: 1, onnotice: () => undefined });
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  } finally {
    await admin.end({ timeout: 5 });
  }
}

async function prepare(): Promise<void> {
  const variables = e2eEnvironment();
  const env = parseEnv(variables);
  await dropDatabase(env.DATABASE_URL);
  await rm(E2E_DATA_DIR, { recursive: true, force: true });
  await runMigrations(env.DATABASE_URL);
  const handle = openDatabase(env.DATABASE_URL);
  const fakeLlm = new FakeLlmProvider();
  try {
    await runSeed({
      container: buildContainer({
        env,
        db: handle.db,
        logger: silentLogger,
        llmForUser: async () => fakeLlm,
      }),
      db: handle.db,
      catalog: new DrizzleCatalogRepository(handle.db),
      log: () => undefined,
    });
  } finally {
    await handle.close();
  }
}

prepare().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "falha ao preparar o e2e");
  process.exit(1);
});
