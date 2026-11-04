import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSrt } from "@/modules/subtitles";
import {
  MIN_MEASURED_WORDS,
  aggregateMeasuredLevels,
  cleanCueText,
  measureSubtitleLevel,
  type MeasurableCue,
} from "./subtitle-level";

const EASY_LINES = [
  "Hi. I am Tom.",
  "Is it your cat?",
  "Yes, it is my cat.",
  "The cat is big.",
  "I like the cat.",
  "Do you want tea?",
  "Yes, I do. Thank you.",
  "It is hot today.",
];

const HARD_LINES = [
  "Considering the unprecedented circumstances, the committee's preliminary recommendations seem remarkably inconsistent with everything we previously negotiated, wouldn't you agree",
  "Nevertheless, establishing accountability requires extraordinarily meticulous documentation, comprehensive verification procedures and an independent investigation of the contradictory testimonies",
  "Unfortunately, the pharmaceutical consortium's quarterly projections deliberately underestimated manufacturing expenditures, distribution complications and the environmental consequences nobody anticipated",
  "Philosophically speaking, our grandmother's eccentric reminiscences about transatlantic voyages illuminate generational misunderstandings surprisingly well",
];

function cuesFrom(lines: readonly string[], repeat: number, durationMs: number): MeasurableCue[] {
  const cues: MeasurableCue[] = [];
  for (let round = 0; round < repeat; round += 1) {
    for (const text of lines) {
      const startMs = cues.length * (durationMs + 500);
      cues.push({ startMs, endMs: startMs + durationMs, text });
    }
  }
  return cues;
}

describe("nível medido pelas falas", () => {
  it("limpa marcação, rubricas, travessão e nome de personagem", () => {
    expect(cleanCueText("<i>- ANA: Hello</i> [door slams]\n- (laughs) Hi {\\an8}there ♪")).toBe(
      "Hello Hi there",
    );
  });

  it("fala lenta e curta fica abaixo da fala rápida, longa e variada", () => {
    const easy = measureSubtitleLevel(cuesFrom(EASY_LINES, 12, 2500), "en");
    const hard = measureSubtitleLevel(cuesFrom(HARD_LINES, 3, 6000), "en");
    expect(easy?.level).toBe("A1");
    expect(hard?.level).toMatch(/^C[12]$/);
    expect(easy && hard && easy.score < hard.score).toBe(true);
    expect(easy?.meanSentenceWords).toBeLessThan(hard?.meanSentenceWords ?? 0);
    expect(easy?.longWordRatio).toBeLessThan(hard?.longWordRatio ?? 0);
  });

  it("é determinística, não depende da ordem das falas e ignora fala sem texto", () => {
    const cues = cuesFrom(EASY_LINES, 12, 2500);
    const shuffled = [...cues].reverse();
    shuffled.push({ startMs: 0, endMs: 10, text: "<i></i>" });
    expect(measureSubtitleLevel(shuffled, "en")).toEqual(measureSubtitleLevel(cues, "en"));
  });

  it("recusa legenda com poucas palavras", () => {
    const few = cuesFrom(["One two three four five."], Math.floor(MIN_MEASURED_WORDS / 5) - 1, 2000);
    expect(measureSubtitleLevel(few, "en")).toBeNull();
  });

  it("mede o diálogo fictício do protótipo nos quatro idiomas", () => {
    const en = parseSrt(readFileSync("fixtures/sample.en.srt", "utf8")).cues;
    const pt = parseSrt(readFileSync("fixtures/sample.pt-BR.srt", "utf8")).cues;
    expect(measureSubtitleLevel(en, "en")).toMatchObject({ words: 189, level: "B1" });
    expect(measureSubtitleLevel(pt, "pt-BR")).toMatchObject({ level: "B1" });
    expect(measureSubtitleLevel(en, "fr")?.longWordRatio).toBeLessThan(
      measureSubtitleLevel(en, "en")?.longWordRatio ?? 0,
    );
  });

  it("a faixa da obra é a mediana dos episódios medidos", () => {
    expect(aggregateMeasuredLevels([])).toBeNull();
    expect(aggregateMeasuredLevels(["B1"])).toEqual(["B1", "B1"]);
    expect(aggregateMeasuredLevels(["B2", "B1"])).toEqual(["B1", "B2"]);
    expect(aggregateMeasuredLevels(["A2", "B1", "B1", "C1"])).toEqual(["B1", "B1"]);
  });
});
