import { randomInt } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const DATABASE_URL_FILE = "database-url.txt";
export const SETUP_CODE_FILE = "setup-code.txt";
const OWNER_ONLY = 0o600;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

export function configDirectory(): string {
  return process.env.DEIXA_CONFIG_DIR?.trim() || process.cwd();
}

function readTrimmed(path: string): string | null {
  if (!existsSync(path)) return null;
  const value = readFileSync(path, "utf8").trim();
  return value.length > 0 ? value : null;
}

function writePrivate(directory: string, file: string, value: string): void {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, file), `${value}\n`, { mode: OWNER_ONLY });
}

export function readStoredDatabaseUrl(directory: string): string | null {
  return readTrimmed(join(directory, DATABASE_URL_FILE));
}

export function saveDatabaseUrl(directory: string, url: string): void {
  writePrivate(directory, DATABASE_URL_FILE, url);
}

export function readSetupCode(directory: string): string | null {
  return readTrimmed(join(directory, SETUP_CODE_FILE));
}

export function ensureSetupCode(directory: string): string {
  const known = readSetupCode(directory);
  if (known) return known;
  const code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(
    "",
  );
  writePrivate(directory, SETUP_CODE_FILE, code);
  return code;
}

export function clearSetupCode(directory: string): void {
  rmSync(join(directory, SETUP_CODE_FILE), { force: true });
}
