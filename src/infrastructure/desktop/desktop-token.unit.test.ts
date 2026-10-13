import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DESKTOP_TOKEN_FILE } from "../config/local-config";
import { createHmac } from "node:crypto";
import { isDesktopToken, issueEntryTicket, proveDesktopPeer, redeemEntryTicket } from "./index";

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

  it("prova que conhece o token sem revelá-lo, e só para um desafio bem formado", () => {
    writeFileSync(join(directory, DESKTOP_TOKEN_FILE), `${token}\n`);
    const nonce = "0f".repeat(16);
    const proof = proveDesktopPeer(nonce);
    expect(proof).toBe(createHmac("sha256", token).update(`hello:${nonce}`).digest("hex"));
    expect(proof).not.toContain(token);
    expect(proveDesktopPeer("0e".repeat(16))).not.toBe(proof);
    expect(proveDesktopPeer("curto")).toBeNull();
    expect(proveDesktopPeer("zz".repeat(16))).toBeNull();
    expect(proveDesktopPeer(null)).toBeNull();
  });

  it("o bilhete de entrada vale uma vez só e por pouco tempo", () => {
    const start = 1_000_000;
    const ticket = issueEntryTicket(start);
    expect(ticket).toMatch(/^[0-9a-f]{64}$/);
    expect(redeemEntryTicket(ticket, start + 1000)).toBe(true);
    expect(redeemEntryTicket(ticket, start + 2000)).toBe(false);

    const late = issueEntryTicket(start);
    expect(redeemEntryTicket(late, start + 31_000)).toBe(false);
    expect(redeemEntryTicket("inventado", start)).toBe(false);
    expect(redeemEntryTicket(undefined, start)).toBe(false);

    const many = Array.from({ length: 25 }, () => issueEntryTicket(start));
    expect(redeemEntryTicket(many[0], start + 1)).toBe(false);
    expect(redeemEntryTicket(many.at(-1), start + 1)).toBe(true);
  });
});
