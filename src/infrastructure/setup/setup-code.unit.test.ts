import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readSetupCode } from "../config/local-config";
import { isSetupCode, prepareSetupCode } from "./index";

const WRONG_ATTEMPTS = 50;

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

  it("aceita o código com ou sem hífens e sem diferenciar maiúsculas", () => {
    const code = readSetupCode(directory) ?? "";
    expect(isSetupCode(code)).toBe(true);
    expect(isSetupCode(code.toLowerCase().replace(/-/g, ""))).toBe(true);
    expect(isSetupCode(undefined)).toBe(false);
    expect(isSetupCode("")).toBe(false);
    expect(isSetupCode(code.slice(0, -1))).toBe(false);
  });

  it("tentativas erradas de terceiros não bloqueiam quem tem o código certo", () => {
    const code = readSetupCode(directory) ?? "";
    for (let attempt = 0; attempt < WRONG_ATTEMPTS; attempt += 1)
      expect(isSetupCode("AAAA-BBBB-CCCC")).toBe(false);
    expect(isSetupCode(code)).toBe(true);
  });
});
