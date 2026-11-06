import { describe, expect, it } from "vitest";
import { lrcToCues, parseLrc } from "./lrc";
import { alignPastedTranslation, applyTranslatedLines } from "./translation";

const cues = lrcToCues(parseLrc("[00:01.00]One\n[00:05.00]Two\n[00:09.00]Three").lines);

describe("alignPastedTranslation", () => {
  it("casa texto simples por índice", () => {
    const result = alignPastedTranslation("Um\n\nDois\nTrês\n", cues);
    expect(result.map((cue) => cue.text)).toEqual(["Um", "Dois", "Três"]);
    expect(result.map((cue) => cue.startMs)).toEqual([1000, 5000, 9000]);
  });

  it("recusa quantidade diferente de linhas", () => {
    expect(() => alignPastedTranslation("Um\nDois", cues)).toThrowError(/MUSIC_TRANSLATION_MISMATCH/);
  });

  it("casa LRC por tempo e pula o que não tem par", () => {
    const result = alignPastedTranslation("[00:01.30]Um\n[00:09.10]Três", cues);
    expect(result.map((cue) => [cue.sequence, cue.text])).toEqual([
      [1, "Um"],
      [2, "Três"],
    ]);
  });
});

describe("applyTranslatedLines", () => {
  it("herda os tempos e descarta falas sem tradução", () => {
    const withIds = cues.map((cue, index) => ({ ...cue, id: `c${index}` }));
    const result = applyTranslatedLines(withIds, [
      { id: "c0", translation: "Um" },
      { id: "c2", translation: "Três" },
    ]);
    expect(result).toEqual([
      { sequence: 1, startMs: 1000, endMs: 5000, text: "Um" },
      { sequence: 2, startMs: 9000, endMs: 13000, text: "Três" },
    ]);
  });
});
