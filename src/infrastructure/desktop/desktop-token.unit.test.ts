import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DESKTOP_TOKEN_FILE } from "../config/local-config";
import { createHmac } from "node:crypto";
import { issueEntryTicket, proveDesktopPeer, redeemEntryTicket, verifyDesktopRequest } from "./index";

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

  const NOW = 1_800_000_000_000;
  const sign = (method: string, path: string, at = NOW, key = token): string => {
    const stamp = String(Math.floor(at / 1000));
    return `${stamp}.${createHmac("sha256", key).update(`${method}\n${path}\n${stamp}`).digest("hex")}`;
  };
  const status = { method: "GET", path: "/api/desktop/status" };

  it("sem o arquivo da casca, nenhum pedido é aceito", () => {
    expect(verifyDesktopRequest({ ...status, signature: sign("GET", status.path) }, NOW)).toBe(false);
    expect(verifyDesktopRequest({ ...status, signature: undefined }, NOW)).toBe(false);
  });

  it("aceita só a assinatura feita com o token, para aquele método e caminho, e por pouco tempo", () => {
    writeFileSync(join(directory, DESKTOP_TOKEN_FILE), `${token}\n`);
    const signature = sign("GET", status.path);
    expect(verifyDesktopRequest({ ...status, signature }, NOW)).toBe(true);
    expect(signature).not.toContain(token);
    expect(verifyDesktopRequest({ method: "POST", path: "/api/desktop/ticket", signature }, NOW)).toBe(false);
    expect(verifyDesktopRequest({ ...status, signature }, NOW + 61_000)).toBe(false);
    expect(
      verifyDesktopRequest({ ...status, signature: sign("GET", status.path, NOW, "b2".repeat(32)) }, NOW),
    ).toBe(false);
    expect(verifyDesktopRequest({ ...status, signature: token }, NOW)).toBe(false);
    expect(verifyDesktopRequest({ ...status, signature: "" }, NOW)).toBe(false);
    writeFileSync(join(directory, DESKTOP_TOKEN_FILE), "curto\n");
    expect(verifyDesktopRequest({ ...status, signature: sign("GET", status.path, NOW, "curto") }, NOW)).toBe(
      false,
    );
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
