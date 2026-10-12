import { rm } from "node:fs/promises";
import postgres from "postgres";
import { parseEnv } from "@/infrastructure/config/env";
import { buildContainer } from "@/infrastructure/container";
import { openDatabase } from "@/infrastructure/database/client";
import { runMigrations } from "@/infrastructure/database/migrate";
import { silentLogger } from "@/infrastructure/logger/logger";
import { DrizzleCatalogRepository } from "@/modules/catalog/infrastructure/drizzle-catalog-repository";
import { FakeMetadataProvider } from "@/modules/catalog/infrastructure/fake-metadata-provider";
import { FakeLlmProvider } from "@/modules/learning/infrastructure/fake-llm-provider";
import { runSeed } from "@/seed/run-seed";
import { E2E_DATA_DIR, E2E_SETUP_CONFIG_DIR, e2eEnvironment, e2eSetupTarget } from "./environment";

const E2E_DATABASES = ["deixa_e2e", "deixa_e2e_setup"];

async function dropDatabase(url: string): Promise<void> {
  const target = new URL(url);
  const name = target.pathname.slice(1);
  if (!E2E_DATABASES.includes(name)) throw new Error("o e2e só recria os bancos de teste");
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
  const databaseUrl = variables.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL ausente para o e2e.");
  await dropDatabase(databaseUrl);
  await rm(E2E_DATA_DIR, { recursive: true, force: true });
  const setupTarget = e2eSetupTarget();
  const setupUrl = new URL(databaseUrl);
  setupUrl.pathname = `/${setupTarget.database}`;
  await dropDatabase(setupUrl.toString());
  await rm(E2E_SETUP_CONFIG_DIR, { recursive: true, force: true });
  await runMigrations(databaseUrl);
  const handle = openDatabase(databaseUrl);
  const fakeLlm = new FakeLlmProvider();
  try {
    await runSeed({
      container: buildContainer({
        env,
        db: handle.db,
        logger: silentLogger,
        llmForUser: async () => fakeLlm,
        plannerForUser: async () => null,
      }),
      db: handle.db,
      catalog: new DrizzleCatalogRepository(handle.db),
      metadata: new FakeMetadataProvider(),
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
