import { describe, expect, it } from "vitest";
import { randomSessionTokens, scryptPasswords } from "./crypto";

describe("senha e token de sessão", () => {
  it("confere a senha certa e recusa a errada, com sal diferente a cada hash", async () => {
    const first = await scryptPasswords.hash("segredo123");
    const second = await scryptPasswords.hash("segredo123");
    expect(first).not.toBe(second);
    expect(first).not.toContain("segredo123");
    expect(await scryptPasswords.verify("segredo123", first)).toBe(true);
    expect(await scryptPasswords.verify("outra", first)).toBe(false);
    expect(await scryptPasswords.verify("segredo123", "formato-invalido")).toBe(false);
  });

  it("emite tokens distintos e hash estável", () => {
    const a = randomSessionTokens.issue();
    const b = randomSessionTokens.issue();
    expect(a.token).not.toBe(b.token);
    expect(randomSessionTokens.hash(a.token)).toBe(a.tokenHash);
    expect(a.tokenHash).not.toContain(a.token);
  });
});
