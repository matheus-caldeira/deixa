import { describe, expect, it } from "vitest";
import { randomSessionTokens, scryptPasswords } from "./crypto";
import { portablePasswords, portableSessionTokens } from "./portable-crypto";

describe("senha e sessão portáveis", () => {
  it("conferem a senha gravada pelo Node e o Node confere a delas", async () => {
    const fromNode = await scryptPasswords.hash("segredo123");
    const fromPortable = await portablePasswords.hash("segredo123");
    expect(await portablePasswords.verify("segredo123", fromNode)).toBe(true);
    expect(await scryptPasswords.verify("segredo123", fromPortable)).toBe(true);
    expect(await portablePasswords.verify("outra", fromNode)).toBe(false);
    expect(await portablePasswords.verify("segredo123", null)).toBe(false);
  });

  it("gera o mesmo hash de token que o Node", () => {
    const { token, tokenHash } = portableSessionTokens.issue();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomSessionTokens.hash(token)).toBe(tokenHash);
  });
});
