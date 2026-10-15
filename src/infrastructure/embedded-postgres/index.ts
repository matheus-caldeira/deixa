import { join } from "node:path";
import { configDirectory } from "../config/local-config";
import { logger } from "../logger/logger";
import { artifactFor } from "./binaries";
import { EMBEDDED_DIRECTORY, EmbeddedPostgres, type EmbeddedPhase } from "./server";

export { POSTGRES_VERSION } from "./binaries";
export type { EmbeddedPhase };

let instance: EmbeddedPostgres | undefined;

export function embeddedPostgres(): EmbeddedPostgres {
  instance ??= new EmbeddedPostgres(join(configDirectory(), EMBEDDED_DIRECTORY));
  return instance;
}

export function embeddedPostgresConfigured(): boolean {
  return embeddedPostgres().isConfigured();
}

export function embeddedPostgresSupported(): boolean {
  return artifactFor() !== null;
}

export async function ensureEmbeddedPostgres(): Promise<void> {
  const server = embeddedPostgres();
  if (!server.isConfigured()) return;
  try {
    await server.start();
  } catch (error) {
    logger.error("embedded_postgres.start_failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
  }
}

let stopping = false;
export function stopEmbeddedPostgresOnExit(): void {
  const stop = () => {
    if (stopping) return;
    stopping = true;
    embeddedPostgres()
      .stop()
      .catch(() => undefined)
      .finally(() => process.exit(0));
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
