import { readFile } from "node:fs/promises";
import { getEnv } from "@/infrastructure/config/env";
import { configDirectory } from "@/infrastructure/config/local-config";
import { loadMasterKey } from "@/infrastructure/config/master-key";
import { buildContainer, resolveDatabaseUrl } from "@/infrastructure/container";
import { openDatabase } from "@/infrastructure/database/client";
import { runMigrations } from "@/infrastructure/database/migrate";
import { silentLogger } from "@/infrastructure/logger/logger";
import { SilentTtsProvider } from "@/modules/audio/infrastructure/silent-tts-provider";
import { DrizzleCatalogRepository } from "@/modules/catalog/infrastructure/drizzle-catalog-repository";
import { StaticMetadataProvider } from "@/modules/catalog/infrastructure/static-metadata-provider";
import { FakeLlmProvider } from "@/modules/learning/infrastructure/fake-llm-provider";
import { runSeed } from "./run-seed";

const CATALOG_FIXTURE = "fixtures/catalog.json";

async function main(): Promise<void> {
  const env = getEnv();
  const url = resolveDatabaseUrl();
  if (!url) throw new Error("Banco não configurado: defina DATABASE_URL ou conclua a tela /setup.");
  await runMigrations(url);
  const handle = openDatabase(url);
  const fakeLlm = new FakeLlmProvider();
  try {
    const metadata = new StaticMetadataProvider(JSON.parse(await readFile(CATALOG_FIXTURE, "utf8")));
    const masterKey = loadMasterKey({
      fromEnvironment: env.AI_CREDENTIALS_MASTER_KEY,
      directory: configDirectory(),
    });
    const container = buildContainer({
      env,
      metadata,
      masterKey: masterKey.value,
      db: handle.db,
      logger: silentLogger,
      tts: new SilentTtsProvider(),
      llmForUser: async () => fakeLlm,
      plannerForUser: async () => null,
    });
    await runSeed({
      container,
      db: handle.db,
      catalog: new DrizzleCatalogRepository(handle.db),
      metadata,
      log: (message) => console.info(`seed: ${message}`),
    });
  } finally {
    await handle.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : "seed failed");
  process.exit(1);
});
