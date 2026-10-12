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
} from "./database-probe";
import { forgetDatabaseStatus, getDatabaseStatus, type DatabaseStatus } from "./database-status";

export { getDatabaseStatus, SETUP_CODE_FILE, TESTED_MAJOR_VERSION };
export type { DatabaseStatus, DetectedServer };

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

export async function configureDatabase(
  url: string,
): Promise<{ ok: true; majorVersion: number | null } | { ok: false; message: string }> {
  if (databaseComesFromEnvironment()) {
    return {
      ok: false,
      message: "A conexão vem da variável DATABASE_URL deste servidor. Ajuste o valor lá e reinicie.",
    };
  }
  const result = await connectAndPrepare(url);
  if (!result.ok) return result;
  saveDatabaseUrl(configDirectory(), result.url);
  clearSetupCode(configDirectory());
  forgetDatabaseStatus();
  await refreshSettings();
  return result;
}
