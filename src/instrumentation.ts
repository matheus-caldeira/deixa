export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getContainer } = await import("@/infrastructure/container");
  const { logger } = await import("@/infrastructure/logger/logger");
  const { providers, devShortcuts } = getContainer();
  logger.info("providers.active", {
    metadata: providers.metadata,
    tts: providers.tts,
    subtitles: providers.subtitles,
    devShortcuts,
  });
}
