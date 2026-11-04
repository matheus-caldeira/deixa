import { getEnv } from "../config/env";
import { getContainer, refreshSettings } from "../container";
import {
  SETUP_CODE_FILE,
  clearSetupCode,
  configDirectory,
  ensureSetupCode,
  matchesSetupCode,
  readSetupCode,
  saveDatabaseUrl,
} from "../config/local-config";
import { WRONG_SETUP_CODE_DELAY_MS } from "../config/setup-code-gate";
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
  const directory = configDirectory();
  if (readSetupCode(directory)) return;
  ensureSetupCode(directory);
  logger.info("setup_code.created", { codeFile: SETUP_CODE_FILE });
}

export async function familyHasAccounts(): Promise<boolean> {
  return getContainer().hasAccounts();
}

export async function prepareFirstAccountCode(): Promise<boolean> {
  if (await familyHasAccounts()) {
    clearSetupCode(configDirectory());
    return false;
  }
  prepareSetupCode();
  return true;
}

export function isSetupCode(candidate: string | undefined): boolean {
  return matchesSetupCode(configDirectory(), candidate);
}

export async function verifySetupCode(candidate: string | undefined): Promise<boolean> {
  if (candidate === undefined) return false;
  if (isSetupCode(candidate)) return true;
  await new Promise((resolve) => setTimeout(resolve, WRONG_SETUP_CODE_DELAY_MS));
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
      const result = await configureDatabase(url);
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
): Promise<{ ok: true; majorVersion: number | null } | { ok: false; failure: ConnectionFailure }> {
  if (databaseComesFromEnvironment()) return { ok: false, failure: "fromEnvironment" };
  const result = await connectAndPrepare(url);
  if (!result.ok) return result;
  saveDatabaseUrl(configDirectory(), result.url);
  forgetDatabaseStatus();
  await refreshSettings();
  return result;
}
