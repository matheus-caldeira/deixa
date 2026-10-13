import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DESKTOP_TOKEN_FILE } from "../config/local-config";
import { isDesktopToken } from "./index";

describe("token local da casca", () => {
  const directory = mkdtempSync(join(tmpdir(), "deixa-desktop-"));
  const previous = process.env.DEIXA_CONFIG_DIR;
  const token = "a1".repeat(32);

  beforeAll(() => {
    process.env.DEIXA_CONFIG_DIR = directory;
  });

  afterAll(() => {
    process.env.DEIXA_CONFIG_DIR = previous;
    rmSync(directory, { recursive: true, force: true });
  });

  it("sem o arquivo da casca, nenhum token é aceito", () => {
    expect(isDesktopToken(token)).toBe(false);
    expect(isDesktopToken(undefined)).toBe(false);
  });

  it("aceita só o token exato do arquivo e ignora arquivo com token curto demais", () => {
    writeFileSync(join(directory, DESKTOP_TOKEN_FILE), `${token}\n`);
    expect(isDesktopToken(token)).toBe(true);
    expect(isDesktopToken(token.toUpperCase())).toBe(false);
    expect(isDesktopToken(`${token}0`)).toBe(false);
    expect(isDesktopToken("")).toBe(false);
    expect(isDesktopToken(null)).toBe(false);
    writeFileSync(join(directory, DESKTOP_TOKEN_FILE), "curto\n");
    expect(isDesktopToken("curto")).toBe(false);
  });
});
