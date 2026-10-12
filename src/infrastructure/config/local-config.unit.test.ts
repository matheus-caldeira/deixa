import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DATABASE_URL_FILE,
  clearSetupCode,
  ensureSetupCode,
  readSetupCode,
  readStoredDatabaseUrl,
  saveDatabaseUrl,
} from "./local-config";

const OWNER_ONLY = 0o600;
const PERMISSION_BITS = 0o777;

describe("configuração local em arquivo", () => {
  let directory: string;

  beforeEach(() => {
    directory = join(mkdtempSync(join(tmpdir(), "deixa-config-")), "interna");
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("guarda o endereço do banco só para o dono e lê de volta", () => {
    expect(readStoredDatabaseUrl(directory)).toBeNull();
    saveDatabaseUrl(directory, "postgres://usuario:senha@localhost:5432/deixa");
    expect(readStoredDatabaseUrl(directory)).toBe("postgres://usuario:senha@localhost:5432/deixa");
    expect(statSync(join(directory, DATABASE_URL_FILE)).mode & PERMISSION_BITS).toBe(OWNER_ONLY);
  });

  it("gera um código de configuração, mantém o mesmo até ser apagado e depois gera outro", () => {
    const first = ensureSetupCode(directory);
    expect(first).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(ensureSetupCode(directory)).toBe(first);
    expect(readSetupCode(directory)).toBe(first);
    clearSetupCode(directory);
    expect(readSetupCode(directory)).toBeNull();
    expect(ensureSetupCode(directory)).not.toBe(first);
  });
});
