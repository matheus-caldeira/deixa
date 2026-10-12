import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readSetupCode } from "../config/local-config";
import { checkSetupCode, checkSetupCookie, prepareSetupCode } from "./index";

describe("código de configuração", () => {
  const directory = mkdtempSync(join(tmpdir(), "deixa-setup-"));
  const previous = process.env.DEIXA_CONFIG_DIR;

  beforeAll(() => {
    process.env.DEIXA_CONFIG_DIR = directory;
    prepareSetupCode();
  });

  afterAll(() => {
    process.env.DEIXA_CONFIG_DIR = previous;
    rmSync(directory, { recursive: true, force: true });
  });

  it("aceita o código certo sem diferenciar maiúsculas; cookie ausente não conta como tentativa", () => {
    const code = readSetupCode(directory) ?? "";
    expect(checkSetupCookie(undefined)).toBe(false);
    expect(checkSetupCode(code.toLowerCase())).toBe("valid");
    expect(checkSetupCookie(code)).toBe(true);
  });

  it("tentativas erradas pelo formulário e pelo cookie somam no mesmo bloqueio", () => {
    const code = readSetupCode(directory) ?? "";
    for (let attempt = 0; attempt < 5; attempt += 1) expect(checkSetupCode("ERRADO99")).toBe("invalid");
    for (let attempt = 0; attempt < 5; attempt += 1) expect(checkSetupCookie("ERRADO99")).toBe(false);
    expect(checkSetupCode(code)).toBe("blocked");
    expect(checkSetupCookie(code)).toBe(false);
  });
});
