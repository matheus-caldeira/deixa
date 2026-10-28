import { describe, expect, it } from "vitest";
import { comparePronunciation, spokenWords } from "./pronunciation";

describe("avaliação de pronúncia", () => {
  it("frase dita inteira vale 100, sem ligar para pontuação e maiúsculas", () => {
    const result = comparePronunciation("Did you split the bill?", "did you split the bill");
    expect(result.score).toBe(100);
    expect(result.words.every((word) => word.heard)).toBe(true);
    expect(result.extra).toBe(0);
  });

  it("marca a palavra que faltou e conta as que sobraram", () => {
    const result = comparePronunciation("I'd like a coffee, please.", "I like a cold coffee please");
    expect(result.words.map((word) => [word.word, word.heard])).toEqual([
      ["I'd", false],
      ["like", true],
      ["a", true],
      ["coffee,", true],
      ["please.", true],
    ]);
    expect(result.extra).toBe(2);
    expect(result.score).toBe(80);
  });

  it("acentos e apóstrofos tipográficos não contam como erro", () => {
    expect(spokenWords("Você não’s")).toEqual(["voce", "nao's"]);
    expect(comparePronunciation("Ação rápida", "acao rapida").score).toBe(100);
  });

  it("nada ouvido vale zero", () => {
    expect(comparePronunciation("Hello there", "").score).toBe(0);
  });
});
