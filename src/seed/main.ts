import { getEnv } from "@/infrastructure/config/env";
import { buildContainer } from "@/infrastructure/container";
import { openDatabase } from "@/infrastructure/database/client";
import { silentLogger } from "@/infrastructure/logger/logger";
import { DrizzleCatalogRepository } from "@/modules/catalog/infrastructure/drizzle-catalog-repository";
import { FakeLlmProvider } from "@/modules/learning/infrastructure/fake-llm-provider";
import { SilentTtsProvider } from "@/modules/audio/infrastructure/silent-tts-provider";
import { runSeed } from "./run-seed";

async function main(): Promise<void> {
  const env = getEnv();
  const handle = openDatabase(env.DATABASE_URL);
  const fakeLlm = new FakeLlmProvider();
  try {
    const container = buildContainer({
      env,
      db: handle.db,
      logger: silentLogger,
      tts: new SilentTtsProvider(),
      llmForUser: async () => fakeLlm,
    });
    await runSeed({
      container,
      db: handle.db,
      catalog: new DrizzleCatalogRepository(handle.db),
      log: (message) => console.info(`seed: ${message}`),
    });
  } finally {
    await handle.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "falha no seed");
  process.exit(1);
});
