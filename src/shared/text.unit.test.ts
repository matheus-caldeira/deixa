import { describe, expect, it } from "vitest";
import { cleanToken, normalizeTerm, termFromTokens, tokenize } from "./text";

describe("texto de falas", () => {
  it("divide a fala em palavras por espaço, inclusive quebras de linha", () => {
    expect(tokenize("Nope. I picked up\nthe tab,  like an idiot.")).toEqual([
      "Nope.",
      "I",
      "picked",
      "up",
      "the",
      "tab,",
      "like",
      "an",
      "idiot.",
    ]);
  });

  it("limpa pontuação das bordas e preserva contrações", () => {
    expect(cleanToken("tab,")).toBe("tab");
    expect(cleanToken("“Don’t”")).toBe("Don't");
    expect(cleanToken("round's")).toBe("round's");
  });

  it("monta o termo a partir de um intervalo de palavras", () => {
    const tokens = tokenize("Nope. I picked up the tab, like an idiot.");
    expect(termFromTokens(tokens, 2, 5)).toBe("picked up the tab");
  });

  it("normaliza o termo para comparação", () => {
    expect(normalizeTerm("  Picked  UP the Tab ")).toBe("picked up the tab");
  });
});
