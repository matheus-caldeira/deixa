import { describe, expect, it } from "vitest";
import { alignCues, estimateFixedOffset, type TimedCue } from "./align-cues";

const cue = (id: string, startMs: number, endMs: number): TimedCue => ({ id, startMs, endMs });

describe("alinhamento EN ↔ PT por sobreposição de tempo", () => {
  it("alinha 1:1 quando os blocos têm tempos próximos", () => {
    const en = [cue("en1", 1000, 3000), cue("en2", 4000, 6000), cue("en3", 7000, 9000)];
    const pt = [cue("pt1", 1050, 3100), cue("pt2", 3950, 5900), cue("pt3", 7100, 9050)];
    const result = alignCues(en, pt);
    expect(result.alignments.map((a) => [a.enCueId, a.ptCueIds, a.status])).toEqual([
      ["en1", ["pt1"], "ALIGNED"],
      ["en2", ["pt2"], "ALIGNED"],
      ["en3", ["pt3"], "ALIGNED"],
    ]);
    expect(result.offsetMs).toBe(0);
    expect(result.rate).toBe(1);
    expect(result.alignments.every((a) => a.overlapScore >= 0.9)).toBe(true);
  });

  it("alinha 1:N quando a legenda PT dividiu uma fala", () => {
    const en = [cue("en1", 0, 4000), cue("en2", 5000, 7000)];
    const pt = [cue("pt1", 0, 1900), cue("pt2", 2000, 4000), cue("pt3", 5000, 7000)];
    const result = alignCues(en, pt);
    expect(result.alignments[0]).toMatchObject({
      enCueId: "en1",
      ptCueIds: ["pt1", "pt2"],
      status: "ALIGNED",
    });
    expect(result.alignments[1]).toMatchObject({ enCueId: "en2", ptCueIds: ["pt3"], status: "ALIGNED" });
  });

  it("alinha N:1 quando a legenda PT juntou duas falas", () => {
    const en = [cue("en1", 0, 2000), cue("en2", 2100, 4000), cue("en3", 6000, 8000)];
    const pt = [cue("pt1", 0, 4000), cue("pt2", 6000, 8000)];
    const result = alignCues(en, pt);
    expect(result.alignments.map((a) => a.ptCueIds)).toEqual([["pt1"], ["pt1"], ["pt2"]]);
    expect(result.alignedCount).toBe(3);
  });

  it("corrige deslocamento fixo antes de alinhar", () => {
    const en = [
      cue("en1", 1000, 2500),
      cue("en2", 3000, 4500),
      cue("en3", 6000, 7500),
      cue("en4", 9000, 10500),
    ];
    const pt = en.map((english, index) => cue(`pt${index + 1}`, english.startMs - 800, english.endMs - 800));
    expect(estimateFixedOffset(en, pt)).toBe(-800);
    const result = alignCues(en, pt);
    expect(result.offsetMs).toBe(-800);
    expect(result.alignments.map((a) => a.ptCueIds)).toEqual([["pt1"], ["pt2"], ["pt3"], ["pt4"]]);
    expect(result.alignments.every((a) => a.overlapScore === 1 && a.offsetMs === -800)).toBe(true);
  });

  it("sem a correção, o mesmo deslocamento deixaria falas sem par", () => {
    const en = [cue("en1", 1000, 2000), cue("en2", 3000, 4000)];
    const ptLate = [cue("pt1", 1900, 2900), cue("pt2", 3900, 4900)];
    const result = alignCues(en, ptLate);
    expect(result.offsetMs).toBe(900);
    expect(result.rate).toBe(1);
  });

  it("marca como UNALIGNED a fala sem par ou com sobreposição baixa", () => {
    const en = [cue("en1", 0, 2000), cue("en2", 3000, 5000), cue("en3", 6000, 8000)];
    const pt = [cue("pt1", 0, 2000), cue("pt3", 7500, 9500)];
    const result = alignCues(en, pt);
    expect(result.alignments.map((a) => a.status)).toEqual(["ALIGNED", "UNALIGNED", "UNALIGNED"]);
    expect(result.alignments[1]).toMatchObject({ ptCueIds: [], overlapScore: 0 });
    expect(result.alignments[2]?.overlapScore).toBe(0.25);
    expect(result.rate).toBeCloseTo(1 / 3);
  });

  it("ignora vizinho que só encosta na fala", () => {
    const en = [cue("en1", 0, 2000), cue("en2", 2000, 4000)];
    const pt = [cue("pt1", 0, 2100), cue("pt2", 2100, 4000)];
    const result = alignCues(en, pt);
    expect(result.alignments.map((a) => a.ptCueIds)).toEqual([["pt1"], ["pt2"]]);
  });

  it("é determinístico e aceita listas vazias", () => {
    const en = [cue("en1", 0, 1000)];
    expect(alignCues(en, [])).toEqual(alignCues(en, []));
    expect(alignCues(en, []).alignments[0]).toMatchObject({ status: "UNALIGNED", ptCueIds: [] });
    expect(alignCues([], []).rate).toBe(0);
  });

  it("alinha dez mil falas em tempo linear, mesmo com todas no mesmo instante", () => {
    const spread = Array.from({ length: 10_000 }, (_, index) =>
      cue(`en${index}`, index * 3000, index * 3000 + 2000),
    );
    const ptSpread = spread.map((english) =>
      cue(`pt-${english.id}`, english.startMs + 300, english.endMs + 300),
    );
    const piled = Array.from({ length: 10_000 }, (_, index) => cue(`x${index}`, 1000, 2000));
    const started = performance.now();
    expect(alignCues(spread, ptSpread).rate).toBe(1);
    alignCues(piled, piled);
    expect(performance.now() - started).toBeLessThan(3000);
  });
});
