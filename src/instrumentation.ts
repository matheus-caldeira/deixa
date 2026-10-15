export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getContainer, refreshSettings, resolveDatabaseUrl } = await import("@/infrastructure/container");
  const { logger } = await import("@/infrastructure/logger/logger");
  const { ensureEmbeddedPostgres, stopEmbeddedPostgresOnExit } =
    await import("@/infrastructure/embedded-postgres");
  stopEmbeddedPostgresOnExit();
  await ensureEmbeddedPostgres();
  if (!resolveDatabaseUrl()) {
    const { prepareSetupCode, SETUP_CODE_FILE } = await import("@/infrastructure/setup");
    prepareSetupCode();
    logger.warn("setup.required", { reason: "database not configured", codeFile: SETUP_CODE_FILE });
    return;
  }
  try {
    await refreshSettings();
    const { providers, devShortcuts } = getContainer();
    logger.info("providers.active", {
      metadata: providers.metadata,
      tts: providers.tts,
      subtitles: providers.subtitles,
      devShortcuts,
    });
  } catch (error) {
    logger.error("startup.failed", { reason: error instanceof Error ? error.message : "desconhecido" });
  }
}
