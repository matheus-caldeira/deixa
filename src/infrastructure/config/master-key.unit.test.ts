import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MASTER_KEY_FILE, loadMasterKey } from "./master-key";

const OWNER_ONLY = 0o600;
const PERMISSION_BITS = 0o777;

describe("chave mestra em arquivo", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "deixa-chave-"));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("gera o arquivo na primeira vez, só para o dono, e reutiliza nas seguintes", () => {
    const first = loadMasterKey({ fromEnvironment: undefined, directory });
    expect(first.origin).toBe("created");
    expect(Buffer.from(first.value, "base64")).toHaveLength(32);
    const path = join(directory, MASTER_KEY_FILE);
    expect(readFileSync(path, "utf8").trim()).toBe(first.value);
    expect(statSync(path).mode & PERMISSION_BITS).toBe(OWNER_ONLY);

    const second = loadMasterKey({ fromEnvironment: undefined, directory });
    expect(second).toEqual({ value: first.value, origin: "file" });
  });

  it("cria a pasta de configuração quando ela ainda não existe", () => {
    const nested = join(directory, "ainda", "não", "existe");
    expect(loadMasterKey({ fromEnvironment: undefined, directory: nested }).origin).toBe("created");
    expect(readdirSync(nested)).toEqual([MASTER_KEY_FILE]);
  });

  it("variável de ambiente tem prioridade e não cria arquivo", () => {
    const fromEnvironment = Buffer.alloc(32, 4).toString("base64");
    expect(loadMasterKey({ fromEnvironment, directory })).toEqual({
      value: fromEnvironment,
      origin: "environment",
    });
    expect(readdirSync(directory)).toEqual([]);
  });

  it("arquivo com conteúdo inválido é guardado com outro nome e uma chave nova é gerada", () => {
    writeFileSync(join(directory, MASTER_KEY_FILE), "isto não é uma chave\n");
    const loaded = loadMasterKey({
      fromEnvironment: undefined,
      directory,
      now: () => new Date("2026-10-12T12:00:00Z"),
    });
    expect(loaded.origin).toBe("replaced");
    expect(Buffer.from(loaded.value, "base64")).toHaveLength(32);
    expect(readdirSync(directory).sort()).toEqual([
      "master-key.invalid-2026-10-12T12-00-00-000Z.txt",
      MASTER_KEY_FILE,
    ]);
  });
});
