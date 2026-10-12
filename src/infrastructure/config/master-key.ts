import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const MASTER_KEY_FILE = "master-key.txt";
const KEY_BYTES = 32;
const OWNER_ONLY = 0o600;

export type MasterKeyOrigin = "environment" | "file" | "created" | "replaced";
export type MasterKey = { value: string; origin: MasterKeyOrigin };

const isValid = (value: string): boolean => Buffer.from(value, "base64").length === KEY_BYTES;

function create(path: string): string {
  const value = randomBytes(KEY_BYTES).toString("base64");
  writeFileSync(path, `${value}\n`, { mode: OWNER_ONLY, flag: "wx" });
  return value;
}

export function loadMasterKey(input: {
  fromEnvironment: string | undefined;
  directory: string;
  now?: () => Date;
}): MasterKey {
  if (input.fromEnvironment) return { value: input.fromEnvironment, origin: "environment" };
  const path = join(input.directory, MASTER_KEY_FILE);
  if (!existsSync(path)) return { value: create(path), origin: "created" };
  const stored = readFileSync(path, "utf8").trim();
  if (isValid(stored)) {
    chmodSync(path, OWNER_ONLY);
    return { value: stored, origin: "file" };
  }
  const stamp = (input.now?.() ?? new Date()).toISOString().replace(/[:.]/g, "-");
  renameSync(path, join(input.directory, `master-key.invalid-${stamp}.txt`));
  return { value: create(path), origin: "replaced" };
}
