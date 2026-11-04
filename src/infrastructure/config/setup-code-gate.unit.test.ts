import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ensureSetupCode, readSetupCode } from "./local-config";
import { fileSetupCodeGate } from "./setup-code-gate";

describe("código de configuração como prova da primeira conta", () => {
  const directory = mkdtempSync(join(tmpdir(), "deixa-gate-"));
  const gate = fileSetupCodeGate(() => directory);

  afterAll(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("sem arquivo, nenhum código vale", async () => {
    expect(await gate.matches("AAAA-BBBB-CCCC")).toBe(false);
  });

  it("aceita o código do arquivo sem diferenciar hífens e maiúsculas e recusa outro", async () => {
    const code = ensureSetupCode(directory);
    expect(await gate.matches(code)).toBe(true);
    expect(await gate.matches(code.toLowerCase().replace(/-/g, ""))).toBe(true);
    expect(await gate.matches("AAAA-BBBB-CCCC")).toBe(false);
  });

  it("gastar o código apaga o arquivo e o código deixa de valer", async () => {
    const code = ensureSetupCode(directory);
    await gate.consume();
    expect(readSetupCode(directory)).toBeNull();
    expect(await gate.matches(code)).toBe(false);
  });
});
