import { getEnv, hasTmdbCredentials } from "@/infrastructure/config/env";
import { TmdbClient } from "@/infrastructure/tmdb/client";
import { TmdbMetadataProvider } from "@/infrastructure/tmdb/tmdb-metadata-provider";
import { FakeMetadataProvider } from "@/modules/catalog/infrastructure/fake-metadata-provider";
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
    const metadata = hasTmdbCredentials(env)
      ? new TmdbMetadataProvider(
          new TmdbClient({ readAccessToken: env.TMDB_READ_ACCESS_TOKEN, apiKey: env.TMDB_API_KEY }),
        )
      : new FakeMetadataProvider();
    const container = buildContainer({
      env,
      metadata,
      db: handle.db,
      logger: silentLogger,
      tts: new SilentTtsProvider(),
      llmForUser: async () => fakeLlm,
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
  console.error(error instanceof Error ? error.message : "falha no seed");
  process.exit(1);
});
