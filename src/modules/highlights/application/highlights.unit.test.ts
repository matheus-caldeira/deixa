import { beforeEach, describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { SequentialIds } from "@/shared/ids";
import {
  MIN_HIGHLIGHT_COUNT_TO_SHOW,
  spansFromMarks,
  tokenRuns,
  visibleMarkCounts,
} from "../domain/highlights";
import {
  makeGetReadingView,
  makeListPendingHighlights,
  makeMarkHighlightsCarded,
  makeSyncHighlights,
} from "./highlight-use-cases";
import { InMemoryHighlights, scriptsFor } from "./testing/fakes";

const PAIR = { target: "en", native: "pt-BR" } as const;

describe("agrupamento de marcações", () => {
  it("junta palavras vizinhas em expressão e mantém separadas as que não se tocam", () => {
    expect(tokenRuns([5, 2, 3, 4, 8, 2])).toEqual([
      [2, 5],
      [8, 8],
    ]);
    expect(tokenRuns([])).toEqual([]);
  });

  it("transforma marcas em palavra, expressão e fala inteira", () => {
    const tokenCounts = new Map([["cue-2", 9]]);
    const spans = spansFromMarks([{ cueId: "cue-2", tokens: [2, 3, 4, 5, 8], wholeLine: true }], tokenCounts);
    expect(spans).toEqual([
      { cueId: "cue-2", startToken: 2, endToken: 5, kind: "phrase" },
      { cueId: "cue-2", startToken: 8, endToken: 8, kind: "word" },
      { cueId: "cue-2", startToken: 0, endToken: 8, kind: "line" },
    ]);
  });

  it("descarta fala desconhecida e posição fora da fala", () => {
    const tokenCounts = new Map([["cue-3", 1]]);
    expect(
      spansFromMarks(
        [
          { cueId: "cue-3", tokens: [0, 1, -1, 2.5], wholeLine: false },
          { cueId: "outra", tokens: [0], wholeLine: true },
        ],
        tokenCounts,
      ),
    ).toEqual([{ cueId: "cue-3", startToken: 0, endToken: 0, kind: "word" }]);
  });

  it("só mostra a contagem anônima a partir do mínimo", () => {
    const counts = visibleMarkCounts([
      { cueId: "a", startToken: 0, endToken: 0, userCount: 1 },
      { cueId: "b", startToken: 0, endToken: 1, userCount: MIN_HIGHLIGHT_COUNT_TO_SHOW },
      { cueId: "b", startToken: 3, endToken: 3, userCount: 3 },
    ]);
    expect([...counts]).toEqual([["b", 3]]);
  });
});

function setup() {
  const highlights = new InMemoryHighlights();
  const deps = {
    highlights,
    loadScript: scriptsFor(["ep-1"]),
    clock: new FixedClock("2026-10-10T12:00:00Z"),
    ids: new SequentialIds("h"),
  };
  return {
    highlights,
    sync: makeSyncHighlights(deps),
    readingView: makeGetReadingView(deps),
    pending: makeListPendingHighlights(deps),
    markCarded: makeMarkHighlightsCarded(deps),
  };
}

describe("marcações do usuário", () => {
  let app: ReturnType<typeof setup>;

  beforeEach(() => {
    app = setup();
  });

  it("salva as marcações e sincroniza por diferença, preservando as que não mudaram", async () => {
    const first = await app.sync({
      userId: "ana",
      pair: PAIR,
      episodeId: "ep-1",
      marks: [
        { cueId: "cue-1", tokens: [5], wholeLine: false },
        { cueId: "cue-2", tokens: [2, 3, 4, 5], wholeLine: false },
      ],
    });
    expect(first.map((h) => [h.cueId, h.startToken, h.endToken, h.kind])).toEqual([
      ["cue-1", 5, 5, "word"],
      ["cue-2", 2, 5, "phrase"],
    ]);
    const phraseId = first[1]?.id;

    const second = await app.sync({
      userId: "ana",
      pair: PAIR,
      episodeId: "ep-1",
      marks: [
        { cueId: "cue-2", tokens: [2, 3, 4, 5], wholeLine: false },
        { cueId: "cue-3", tokens: [], wholeLine: true },
      ],
    });
    expect(second.map((h) => [h.cueId, h.kind])).toEqual([
      ["cue-2", "phrase"],
      ["cue-3", "line"],
    ]);
    expect(second[0]?.id).toBe(phraseId);
  });

  it("repetir a mesma sincronização não duplica nada", async () => {
    const marks = [{ cueId: "cue-1", tokens: [1, 2], wholeLine: false }];
    await app.sync({ userId: "ana", pair: PAIR, episodeId: "ep-1", marks });
    await app.sync({ userId: "ana", pair: PAIR, episodeId: "ep-1", marks });
    expect(app.highlights.rows).toHaveLength(1);
  });

  it("isola as marcações: um usuário não vê nem apaga as do outro", async () => {
    await app.sync({
      userId: "ana",
      pair: PAIR,
      episodeId: "ep-1",
      marks: [{ cueId: "cue-1", tokens: [5], wholeLine: false }],
    });
    await app.sync({
      userId: "lucas",
      pair: PAIR,
      episodeId: "ep-1",
      marks: [{ cueId: "cue-2", tokens: [7, 8], wholeLine: false }],
    });

    const ana = await app.readingView("ana", "ep-1", PAIR);
    const lucas = await app.readingView("lucas", "ep-1", PAIR);
    expect(ana.highlights.map((h) => h.cueId)).toEqual(["cue-1"]);
    expect(lucas.highlights.map((h) => h.cueId)).toEqual(["cue-2"]);

    await app.sync({ userId: "lucas", pair: PAIR, episodeId: "ep-1", marks: [] });
    expect((await app.readingView("ana", "ep-1", PAIR)).highlights).toHaveLength(1);
    expect((await app.readingView("lucas", "ep-1", PAIR)).highlights).toHaveLength(0);
  });

  it("entrega a legenda com palavras separadas e a tradução de cada fala", async () => {
    const view = await app.readingView("ana", "ep-1", PAIR);
    expect(view.hasNative).toBe(true);
    expect(view.lines[1]).toMatchObject({
      tokens: ["Nope.", "I", "picked", "up", "the", "tab,", "like", "an", "idiot."],
      translation: "Não. Eu paguei a conta, feito um idiota.",
      translationSource: "subtitle_pt",
      markedByCount: null,
    });
    expect(view.lines[2]).toMatchObject({ translation: null, translationSource: null });
    await expect(app.readingView("ana", "sem-legenda", PAIR)).rejects.toMatchObject({
      code: "EPISODE_NOT_READY",
    });
  });

  it("marcações privadas não entram na contagem; as do catálogo entram sem identificar ninguém", async () => {
    const mark = [{ cueId: "cue-2", tokens: [2, 3, 4, 5], wholeLine: false }];
    for (const userId of ["ana", "matheus", "lucas"]) {
      await app.sync({ userId, episodeId: "ep-1", pair: PAIR, marks: mark });
    }
    const idsOf = async (userId: string) => (await app.pending(userId, "ep-1")).map((h) => h.id);

    await app.markCarded({
      userId: "ana",
      episodeId: "ep-1",
      highlightIds: await idsOf("ana"),
      batchId: "b1",
      scope: "private",
    });
    expect(app.highlights.stats).toEqual([]);

    await app.markCarded({
      userId: "matheus",
      episodeId: "ep-1",
      highlightIds: await idsOf("matheus"),
      batchId: "b2",
      scope: "catalog",
    });
    expect((await app.readingView("ana", "ep-1", PAIR)).lines[1]?.markedByCount).toBeNull();

    await app.markCarded({
      userId: "lucas",
      episodeId: "ep-1",
      highlightIds: await idsOf("lucas"),
      batchId: "b3",
      scope: "catalog",
    });
    expect((await app.readingView("ana", "ep-1", PAIR)).lines[1]?.markedByCount).toBe(2);
    expect(Object.keys(app.highlights.stats[0] ?? {}).sort()).toEqual([
      "cueId",
      "endToken",
      "episodeId",
      "startToken",
      "userCount",
    ]);
  });

  it("não conta duas vezes a mesma marcação e tira da fila as que já viraram card", async () => {
    await app.sync({
      userId: "ana",
      pair: PAIR,
      episodeId: "ep-1",
      marks: [{ cueId: "cue-1", tokens: [5], wholeLine: false }],
    });
    const [highlight] = await app.pending("ana", "ep-1");
    if (!highlight) throw new Error("marcação esperada");
    const input = {
      userId: "ana",
      episodeId: "ep-1",
      highlightIds: [highlight.id],
      batchId: "b1",
      scope: "catalog" as const,
    };
    await app.markCarded(input);
    await app.markCarded(input);
    expect(app.highlights.stats).toMatchObject([{ cueId: "cue-1", userCount: 1 }]);
    expect(await app.pending("ana", "ep-1")).toEqual([]);
    expect((await app.readingView("ana", "ep-1", PAIR)).highlights[0]).toMatchObject({
      cardBatchId: "b1",
      shareScope: "catalog",
    });
  });

  it("conta usuários distintos: uma pessoa sozinha não infla a contagem nem atinge o mínimo", async () => {
    const marks = [{ cueId: "cue-2", tokens: [2, 3, 4, 5], wholeLine: false }];
    for (let round = 0; round < 3; round += 1) {
      await app.sync({ userId: "ana", pair: PAIR, episodeId: "ep-1", marks });
      const ids = (await app.pending("ana", "ep-1")).map((h) => h.id);
      await app.markCarded({
        userId: "ana",
        episodeId: "ep-1",
        highlightIds: ids,
        batchId: `b${round}`,
        scope: "catalog",
      });
      expect(app.highlights.stats).toMatchObject([{ cueId: "cue-2", userCount: 1 }]);
      await app.sync({ userId: "ana", pair: PAIR, episodeId: "ep-1", marks: [] });
      expect(app.highlights.stats).toEqual([]);
    }
    expect((await app.readingView("lucas", "ep-1", PAIR)).lines[1]?.markedByCount).toBeNull();
  });

  it("não marca como card a marcação de outro usuário", async () => {
    await app.sync({
      userId: "ana",
      pair: PAIR,
      episodeId: "ep-1",
      marks: [{ cueId: "cue-1", tokens: [5], wholeLine: false }],
    });
    const [anaHighlight] = await app.pending("ana", "ep-1");
    if (!anaHighlight) throw new Error("marcação esperada");
    await app.markCarded({
      userId: "lucas",
      episodeId: "ep-1",
      highlightIds: [anaHighlight.id],
      batchId: "b9",
      scope: "catalog",
    });
    expect(await app.pending("ana", "ep-1")).toHaveLength(1);
    expect(app.highlights.stats).toEqual([]);
  });
});
