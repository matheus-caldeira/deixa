import { getEnv } from "@/infrastructure/config/env";
import { getContainer, refreshSettings, resolveDatabaseUrl } from "@/infrastructure/container";
import { logger } from "@/infrastructure/logger/logger";

const SETTINGS_REFRESH_MS = 60_000;
const SLEEP_SLICE_MS = 250;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const env = getEnv();
  if (!resolveDatabaseUrl()) throw new Error("DATABASE_URL ausente. Rode pnpm setup:env.");
  await refreshSettings();
  let lastRefresh = Date.now();
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  logger.info("worker.started", { pollMs: env.JOBS_POLL_MS, tts: getContainer().providers.tts });

  while (!stopping) {
    if (Date.now() - lastRefresh > SETTINGS_REFRESH_MS) {
      await refreshSettings().catch((error: unknown) =>
        logger.warn("worker.settings_refresh_failed", {
          reason: error instanceof Error ? error.message : "unknown",
        }),
      );
      lastRefresh = Date.now();
    }
    const outcome = await getContainer()
      .runNextJob()
      .catch((error: unknown) => {
        logger.error("worker.claim_failed", { reason: error instanceof Error ? error.message : "unknown" });
        return null;
      });
    if (outcome) {
      logger.info(`job.${outcome.outcome}`, {
        jobId: outcome.job.id,
        kind: outcome.job.kind,
        attempts: outcome.job.attempts,
        ...(outcome.outcome === "done" ? {} : { reason: outcome.reason }),
      });
      continue;
    }
    for (let waited = 0; waited < env.JOBS_POLL_MS && !stopping; waited += SLEEP_SLICE_MS) {
      await sleep(SLEEP_SLICE_MS);
    }
  }
  logger.info("worker.stopped");
}

main().catch((error: unknown) => {
  logger.error("worker.crashed", { reason: error instanceof Error ? error.message : "unknown" });
  process.exit(1);
});
