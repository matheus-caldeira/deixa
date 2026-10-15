import { timingSafeEqual } from "node:crypto";
import { getEnv } from "../config/env";
import { refreshSettings } from "../container";
import {
  SETUP_CODE_FILE,
  clearSetupCode,
  configDirectory,
  ensureSetupCode,
  normalizeSetupCode,
  readSetupCode,
  saveDatabaseUrl,
} from "../config/local-config";
import {
  TESTED_MAJOR_VERSION,
  connectAndPrepare,
  detectLocalServers,
  type DetectedServer,
  type ConnectionFailure,
} from "./database-probe";
import { forgetDatabaseStatus, getDatabaseStatus, type DatabaseStatus } from "./database-status";
import {
  embeddedPostgres,
  embeddedPostgresConfigured,
  embeddedPostgresSupported,
  type EmbeddedPhase,
} from "../embedded-postgres";
import { logger } from "../logger/logger";

export { getDatabaseStatus, SETUP_CODE_FILE, TESTED_MAJOR_VERSION };
export type { DatabaseStatus, DetectedServer, EmbeddedPhase };

export function prepareSetupCode(): void {
  ensureSetupCode(configDirectory());
}

export function isSetupCode(candidate: string | undefined): boolean {
  const expected = readSetupCode(configDirectory());
  if (!expected || !candidate) return false;
  const given = Buffer.from(normalizeSetupCode(candidate));
  const known = Buffer.from(normalizeSetupCode(expected));
  return given.length === known.length && timingSafeEqual(given, known);
}

const WRONG_CODE_DELAY_MS = 1000;

export async function verifySetupCode(candidate: string | undefined): Promise<boolean> {
  if (candidate === undefined) return false;
  if (isSetupCode(candidate)) return true;
  await new Promise((resolve) => setTimeout(resolve, WRONG_CODE_DELAY_MS));
  return false;
}

export function databaseComesFromEnvironment(): boolean {
  return Boolean(getEnv().DATABASE_URL);
}

export function serverPlatform(): "macos" | "windows" | "linux" {
  if (process.platform === "darwin") return "macos";
  return process.platform === "win32" ? "windows" : "linux";
}

export const findLocalServers = (): Promise<DetectedServer[]> => detectLocalServers();

export function embeddedDatabaseAvailable(): boolean {
  return embeddedPostgresSupported() && !databaseComesFromEnvironment();
}

export function embeddedDatabaseStatus(): EmbeddedPhase {
  return embeddedPostgres().status;
}

export function embeddedDatabaseConfigured(): boolean {
  return embeddedPostgresConfigured();
}

let installing: Promise<void> | null = null;

export function startEmbeddedDatabaseInstall(): void {
  if (installing || !embeddedDatabaseAvailable()) return;
  installing = embeddedPostgres()
    .install()
    .then(async (url) => {
      const result = await configureDatabase(url, { keepSetupCode: true });
      if (!result.ok) throw new Error(result.failure);
      logger.info("embedded_postgres.ready", { port: new URL(url).port });
    })
    .catch((error: unknown) => {
      logger.error("embedded_postgres.install_failed", {
        reason: error instanceof Error ? error.message : "unknown",
      });
    })
    .finally(() => {
      installing = null;
    });
}

export function finishSetup(): void {
  clearSetupCode(configDirectory());
}

export async function configureDatabase(
  url: string,
  options: { keepSetupCode?: boolean } = {},
): Promise<{ ok: true; majorVersion: number | null } | { ok: false; failure: ConnectionFailure }> {
  if (databaseComesFromEnvironment()) return { ok: false, failure: "fromEnvironment" };
  const result = await connectAndPrepare(url);
  if (!result.ok) return result;
  saveDatabaseUrl(configDirectory(), result.url);
  if (!options.keepSetupCode) clearSetupCode(configDirectory());
  forgetDatabaseStatus();
  await refreshSettings();
  return result;
}
