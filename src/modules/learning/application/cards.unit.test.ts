import { beforeEach, describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { SequentialIds } from "@/shared/ids";
import { FakeLlmProvider } from "../infrastructure/fake-llm-provider";
import { makeConfirmCardBatch, makeGetSpeakableItem, makeListCatalogSuggestions } from "./confirm-card-batch";
import {
  CARD_BATCH_TIMEOUT_MS,
  makeGetCardBatch,
  makeProcessCardBatch,
  makeRequestCardDrafts,
} from "./card-batch-jobs";
import { makeGenerateCardDrafts } from "./generate-card-drafts";
import type { LlmProvider, PendingHighlight, ScriptLineForCards } from "./ports";
import { makeTranslateCue } from "./translate-cue";
import { CollaboratorSpy, InMemoryLearning } from "./testing/fakes";

const LINES: ScriptLineForCards[] = [
  {
    cueId: "cue-1",
    text: "Nope. I picked up the tab, like an idiot.",
    startMs: 291_220,
    endMs: 293_920,
    translation: "Não. Eu paguei a conta, feito um idiota.",
    translationSource: "subtitle_pt",
  },
  {
    cueId: "cue-2",
    text: "Just play it cool. Don't overthink it.",
    startMs: 504_220,
    endMs: 506_820,
    translation: "Só fica tranquilo. Não pensa demais.",
    translationSource: "subtitle_pt",
  },
  {
    cueId: "cue-3",
    text: "Promise?",
    startMs: 766_220,
    endMs: 767_120,
    translation: null,
    translationSource: null,
  },
];

const PHRASE: PendingHighlight = {
  id: "h-phrase",
  cueId: "cue-1",
  startToken: 2,
  endToken: 5,
  kind: "phrase",
};
const WORD: PendingHighlight = { id: "h-word", cueId: "cue-2", startToken: 5, endToken: 5, kind: "word" };
const LINE_WITH_PT: PendingHighlight = {
  id: "h-line",
  cueId: "cue-2",
  startToken: 0,
  endToken: 6,
  kind: "line",
};
const LINE_WITHOUT_PT: PendingHighlight = {
  id: "h-orphan",
  cueId: "cue-3",
  startToken: 0,
  endToken: 0,
  kind: "line",
};

function setup(llm: LlmProvider = new FakeLlmProvider()) {
  const learning = new InMemoryLearning();
  const spy = new CollaboratorSpy(LINES, llm);
  const deps = {
    learning,
    clock: new FixedClock("2026-10-10T12:00:00Z"),
    ids: new SequentialIds("l"),
    ...spy.collaborators(),
  };
  return {
    learning,
    spy,
    llm,
    generate: makeGenerateCardDrafts(deps),
    confirm: makeConfirmCardBatch(deps),
    suggestions: makeListCatalogSuggestions(deps),
    speakable: makeGetSpeakableItem(deps),
  };
}

const requestsOf = (llm: LlmProvider) => (llm as FakeLlmProvider).requests;

const PAIR = { target: "en", native: "pt-BR" } as const;

describe("geração de cards a partir das marcações", () => {
  let app: ReturnType<typeof setup>;

  beforeEach(() => {
    app = setup();
  });

  it("explica todos os termos em uma única chamada em lote e não pede à IA a tradução da fala alinhada", async () => {
    app.spy.setPending("matheus", [PHRASE, WORD, LINE_WITH_PT]);
    const result = await app.generate({
      userId: "matheus",
      episodeId: "ep-1",
      learnerLevel: "B1",
      pair: PAIR,
    });

    expect(result.llmCalls).toBe(1);
    expect(requestsOf(app.llm)).toHaveLength(1);
    expect(requestsOf(app.llm)[0]?.items.map((item) => [item.id, item.term, item.lineTranslation])).toEqual([
      ["h-phrase", "picked up the tab", "Não. Eu paguei a conta, feito um idiota."],
      ["h-word", "overthink", "Só fica tranquilo. Não pensa demais."],
    ]);
    expect(
      result.drafts.map((draft) => [draft.term, draft.itemType, draft.meaning, draft.meaningSource]),
    ).toEqual([
      ["picked up the tab", "expression", "pagou a conta (de todos)", "llm"],
      ["overthink", "word", "pensar demais", "llm"],
      [
        "Just play it cool. Don't overthink it.",
        "sentence",
        "Só fica tranquilo. Não pensa demais.",
        "subtitle_pt",
      ],
    ]);
    expect(result.drafts.every((draft) => draft.lineTranslationSource === "subtitle_pt")).toBe(true);
    expect(result.translationsFromSubtitle).toBe(3);
    expect(result.steps.map((step) => step.counts)).toEqual([
      { highlights: 3, expressions: 1 },
      { fromSubtitle: 3, byLlm: 0 },
      { reused: 0, llmCalls: 1, provider: "fake" },
      {},
      { cards: 3 },
    ]);
  });

  it("não chama a IA quando só há falas inteiras com par na legenda PT", async () => {
    app.spy.setPending("ana", [LINE_WITH_PT]);
    const result = await app.generate({ userId: "ana", episodeId: "ep-1", learnerLevel: "A1", pair: PAIR });
    expect(result.llmCalls).toBe(0);
    expect(requestsOf(app.llm)).toHaveLength(0);
    expect(result.drafts[0]).toMatchObject({ meaningSource: "subtitle_pt", difficulty: "A1" });
  });

  it("cai para a IA, com etiqueta, quando a fala não tem par na legenda PT", async () => {
    app.spy.setPending("ana", [LINE_WITHOUT_PT]);
    const result = await app.generate({ userId: "ana", episodeId: "ep-1", learnerLevel: "A1", pair: PAIR });
    expect(result.drafts[0]).toMatchObject({
      term: "Promise?",
      meaning: "Promete?",
      meaningSource: "llm",
      lineTranslation: "Promete?",
      lineTranslationSource: "llm",
    });
    expect(result.steps[1]).toEqual({
      key: "translateMissing",
      counts: { fromSubtitle: 0, byLlm: 1 },
    });
  });

  it("recusa saída da IA fora do formato e não salva nada", async () => {
    const broken: LlmProvider = {
      name: "gemini",
      explainTerms: async () => [{ id: "h-phrase", meaning: "", itemType: "poema", difficulty: "Z9" }],
      translateLines: async () => [],
    };
    const strict = setup(broken);
    strict.spy.setPending("ana", [PHRASE]);
    await expect(
      strict.generate({ userId: "ana", episodeId: "ep-1", learnerLevel: "A1", pair: PAIR }),
    ).rejects.toMatchObject({
      code: "LLM_INVALID_OUTPUT",
    });
    expect(strict.learning.batches).toHaveLength(0);

    const partial: LlmProvider = {
      name: "gemini",
      explainTerms: async () => [],
      translateLines: async () => [],
    };
    const incomplete = setup(partial);
    incomplete.spy.setPending("ana", [PHRASE]);
    await expect(
      incomplete.generate({ userId: "ana", episodeId: "ep-1", learnerLevel: "A1", pair: PAIR }),
    ).rejects.toMatchObject({
      code: "LLM_INVALID_OUTPUT",
    });

    const offline: LlmProvider = {
      name: "gemini",
      explainTerms: async () => {
        throw new Error("timeout");
      },
      translateLines: async () => [],
    };
    const down = setup(offline);
    down.spy.setPending("ana", [PHRASE]);
    await expect(
      down.generate({ userId: "ana", episodeId: "ep-1", learnerLevel: "A1", pair: PAIR }),
    ).rejects.toMatchObject({
      code: "LLM_FAILED",
    });
  });

  it("recusa explicação da IA com link, marcação ou texto invisível, que poderia contaminar o catálogo", async () => {
    const attempt = async (meaning: string) => {
      const hostile: LlmProvider = {
        name: "gemini",
        explainTerms: async () => [{ id: "h-phrase", meaning, itemType: "expression", difficulty: "B1" }],
        translateLines: async () => [],
      };
      const scenario = setup(hostile);
      scenario.spy.setPending("ana", [PHRASE]);
      return scenario.generate({ userId: "ana", episodeId: "ep-1", learnerLevel: "A1", pair: PAIR });
    };
    await expect(attempt("pagou a conta. Veja mais em https://exemplo.test")).rejects.toMatchObject({
      code: "LLM_INVALID_OUTPUT",
    });
    await expect(attempt("<img src=x onerror=alert(1)>")).rejects.toMatchObject({
      code: "LLM_INVALID_OUTPUT",
    });
    await expect(attempt("clique [aqui](javascript:alert(1))")).rejects.toMatchObject({
      code: "LLM_INVALID_OUTPUT",
    });
    const cleaned = await attempt("pagou\u202e a\u0000 conta\n(de todos)");
    expect(cleaned.drafts[0]?.meaning).toBe("pagou a conta (de todos)");
  });

  it("avisa quando não há marcações ou o episódio não está pronto", async () => {
    await expect(
      app.generate({ userId: "ana", episodeId: "ep-1", learnerLevel: "A1", pair: PAIR }),
    ).rejects.toMatchObject({
      code: "NO_HIGHLIGHTS",
    });
    await expect(
      app.generate({ userId: "ana", episodeId: "outro", learnerLevel: "A1", pair: PAIR }),
    ).rejects.toMatchObject({
      code: "EPISODE_NOT_READY",
    });
  });
});

describe("salvar cards: só para mim ou para o catálogo", () => {
  let app: ReturnType<typeof setup>;

  beforeEach(() => {
    app = setup();
  });

  it("cards só para mim ficam privados e não aparecem nem são reutilizados para outro usuário", async () => {
    app.spy.setPending("ana", [PHRASE]);
    const anaBatch = await app.generate({ userId: "ana", episodeId: "ep-1", learnerLevel: "A1", pair: PAIR });
    const saved = await app.confirm({
      userId: "ana",
      pair: PAIR,
      batchId: anaBatch.batchId,
      keepKeys: ["h-phrase"],
      scope: "private",
    });
    expect(saved).toEqual({ cardsCreated: 1, cardsKept: 1, xpAwarded: 10, scope: "private" });
    expect(app.learning.items).toMatchObject([{ visibility: "private", ownerUserId: "ana" }]);
    expect(await app.suggestions("ep-1", "en")).toEqual([]);

    const anaItemId = app.learning.items[0]?.id ?? "";
    expect(await app.speakable("ana", anaItemId)).toEqual({ text: "picked up the tab", language: "en" });
    await expect(app.speakable("lucas", anaItemId)).rejects.toMatchObject({ code: "ITEM_NOT_FOUND" });

    app.spy.setPending("lucas", [{ ...PHRASE, id: "h-lucas" }]);
    const lucasBatch = await app.generate({
      userId: "lucas",
      episodeId: "ep-1",
      learnerLevel: "C1",
      pair: PAIR,
    });
    expect(lucasBatch.drafts[0]?.reusedItemId).toBeNull();
    expect(lucasBatch.llmCalls).toBe(1);
    await app.confirm({
      userId: "lucas",
      pair: PAIR,
      batchId: lucasBatch.batchId,
      keepKeys: ["h-lucas"],
      scope: "private",
    });
    expect(app.learning.items.map((item) => item.ownerUserId)).toEqual(["ana", "lucas"]);
    expect([...(app.spy.cardsByUser.get("lucas") ?? [])]).not.toContain(anaItemId);
  });

  it("cards para o catálogo viram sugestão anônima e são reaproveitados sem nova chamada de IA", async () => {
    app.spy.setPending("matheus", [PHRASE]);
    const first = await app.generate({
      userId: "matheus",
      episodeId: "ep-1",
      learnerLevel: "B1",
      pair: PAIR,
    });
    await app.confirm({
      userId: "matheus",
      pair: PAIR,
      batchId: first.batchId,
      keepKeys: ["h-phrase"],
      scope: "catalog",
    });
    expect(app.learning.items).toMatchObject([{ visibility: "global", ownerUserId: null }]);
    expect(await app.suggestions("ep-1", "en")).toMatchObject([
      { term: "picked up the tab", cueId: "cue-1" },
    ]);
    expect(Object.keys((await app.suggestions("ep-1", "en"))[0] ?? {}).sort()).toEqual([
      "cueId",
      "endToken",
      "itemId",
      "startToken",
      "term",
    ]);

    app.spy.setPending("ana", [{ ...PHRASE, id: "h-ana" }]);
    const second = await app.generate({ userId: "ana", episodeId: "ep-1", learnerLevel: "A1", pair: PAIR });
    expect(second.llmCalls).toBe(0);
    expect(second.drafts[0]?.reusedItemId).toBe(app.learning.items[0]?.id);
    await app.confirm({
      userId: "ana",
      pair: PAIR,
      batchId: second.batchId,
      keepKeys: ["h-ana"],
      scope: "private",
    });
    expect(app.learning.items).toHaveLength(1);
    expect(app.learning.items[0]).toMatchObject({ visibility: "global", ownerUserId: null });
  });

  it("promove o card privado do próprio usuário quando ele decide compartilhar", async () => {
    app.spy.setPending("ana", [PHRASE]);
    const first = await app.generate({ userId: "ana", episodeId: "ep-1", learnerLevel: "A1", pair: PAIR });
    await app.confirm({
      userId: "ana",
      pair: PAIR,
      batchId: first.batchId,
      keepKeys: ["h-phrase"],
      scope: "private",
    });

    app.spy.setPending("ana", [{ ...PHRASE, id: "h-again" }]);
    const second = await app.generate({ userId: "ana", episodeId: "ep-1", learnerLevel: "A1", pair: PAIR });
    const saved = await app.confirm({
      userId: "ana",
      pair: PAIR,
      batchId: second.batchId,
      keepKeys: ["h-again"],
      scope: "catalog",
    });
    expect(saved.cardsCreated).toBe(0);
    expect(app.learning.items).toHaveLength(1);
    expect(app.learning.items[0]).toMatchObject({ visibility: "global", ownerUserId: null });
  });

  it("salva só os cards mantidos pelo usuário e marca só as marcações deles", async () => {
    app.spy.setPending("ana", [PHRASE, WORD]);
    const batch = await app.generate({ userId: "ana", episodeId: "ep-1", learnerLevel: "A1", pair: PAIR });
    const saved = await app.confirm({
      userId: "ana",
      pair: PAIR,
      batchId: batch.batchId,
      keepKeys: ["h-word"],
      scope: "private",
    });
    expect(saved.cardsCreated).toBe(1);
    expect(app.learning.items.map((item) => item.term)).toEqual(["overthink"]);
    expect(app.spy.carded).toEqual([{ userId: "ana", highlightIds: ["h-word"], scope: "private" }]);
    expect(app.spy.pending.get("ana")?.map((highlight) => highlight.id)).toEqual(["h-phrase"]);
  });

  it("não deixa confirmar o lote de outro usuário nem o mesmo lote duas vezes", async () => {
    app.spy.setPending("ana", [PHRASE]);
    const batch = await app.generate({ userId: "ana", episodeId: "ep-1", learnerLevel: "A1", pair: PAIR });
    await expect(
      app.confirm({
        userId: "lucas",
        pair: PAIR,
        batchId: batch.batchId,
        keepKeys: ["h-phrase"],
        scope: "catalog",
      }),
    ).rejects.toMatchObject({ code: "BATCH_NOT_FOUND" });
    expect(app.learning.items).toHaveLength(0);

    await app.confirm({
      userId: "ana",
      pair: PAIR,
      batchId: batch.batchId,
      keepKeys: ["h-phrase"],
      scope: "private",
    });
    await expect(
      app.confirm({
        userId: "ana",
        pair: PAIR,
        batchId: batch.batchId,
        keepKeys: ["h-phrase"],
        scope: "private",
      }),
    ).rejects.toMatchObject({ code: "BATCH_NOT_FOUND" });
    expect(app.learning.items).toHaveLength(1);
    expect(app.spy.xp).toEqual([
      { userId: "ana", source: "highlight_cards", sourceId: batch.batchId, amount: 10 },
    ]);
    await expect(
      app.confirm({ userId: "ana", pair: PAIR, batchId: "inexistente", keepKeys: [], scope: "private" }),
    ).rejects.toMatchObject({ code: "BATCH_NOT_FOUND" });
  });
});

describe("geração em segundo plano", () => {
  function background(llm: LlmProvider = new FakeLlmProvider()) {
    const base = setup(llm);
    const clock = new FixedClock("2026-10-10T12:00:00Z");
    const sent: { userId: string; kind: string; params: Record<string, string | number>; href: string }[] =
      [];
    const deps = { learning: base.learning, clock, ids: new SequentialIds("job") };
    return {
      ...base,
      clock,
      sent,
      request: makeRequestCardDrafts(deps),
      state: makeGetCardBatch(deps),
      process: makeProcessCardBatch({
        learning: base.learning,
        generate: base.generate,
        notify: async (notification) => {
          sent.push(notification);
        },
      }),
    };
  }
  const job = {
    userId: "ana",
    episodeId: "ep-1",
    learnerLevel: "A1" as const,
    pair: PAIR,
    episodeLabel: "Friends · T1 · E1",
  };

  it("responde na hora com o lote pendente e avisa quando os cards ficam prontos", async () => {
    const app = background();
    app.spy.setPending("ana", [PHRASE, WORD]);
    const { batchId } = await app.request(job);
    expect(await app.state("ana", batchId)).toMatchObject({ status: "PENDING" });

    await app.process({ ...job, batchId });
    const ready = await app.state("ana", batchId);
    expect(ready).toMatchObject({ status: "DRAFT", simulated: true, translationsFromSubtitle: 2 });
    expect(ready.status === "DRAFT" ? ready.drafts.map((draft) => draft.term) : []).toEqual([
      "picked up the tab",
      "overthink",
    ]);
    expect(app.sent).toEqual([
      expect.objectContaining({
        userId: "ana",
        kind: "cards_ready",
        params: { episode: "Friends · T1 · E1", count: 2 },
        href: `/read?id=ep-1&batch=${batchId}`,
      }),
    ]);
    await app.confirm({ userId: "ana", pair: PAIR, batchId, keepKeys: ["h-phrase"], scope: "private" });
    expect(await app.state("ana", batchId)).toMatchObject({ status: "SAVED" });
  });

  it("registra a falha, avisa o usuário e não deixa o lote travado", async () => {
    const offline: LlmProvider = {
      name: "gemini",
      explainTerms: async () => {
        throw new Error("timeout");
      },
      translateLines: async () => [],
    };
    const app = background(offline);
    app.spy.setPending("ana", [PHRASE]);
    const { batchId } = await app.request(job);
    await app.process({ ...job, batchId });
    expect(await app.state("ana", batchId)).toMatchObject({
      status: "FAILED",
      reason: "LLM_FAILED",
    });
    expect(app.sent[0]).toMatchObject({ kind: "cards_failed", href: "/read?id=ep-1" });
  });

  it("considera falho o lote que ficou pendente além do limite e esconde lotes de outro usuário", async () => {
    const app = background();
    const { batchId } = await app.request(job);
    await expect(app.state("lucas", batchId)).rejects.toMatchObject({ code: "BATCH_NOT_FOUND" });
    app.clock.advanceMs(CARD_BATCH_TIMEOUT_MS + 1000);
    expect(await app.state("ana", batchId)).toMatchObject({ status: "FAILED" });
  });
});

describe("tradução sob demanda de uma fala", () => {
  it("devolve a tradução da legenda sem chamar a IA e guarda a tradução por IA para todos", async () => {
    const llm = new FakeLlmProvider();
    const saved = new Map<string, string>();
    const translateCue = makeTranslateCue({
      resolveLlm: async () => llm,
      saveCueTranslation: async (cueId, _pair, text) => {
        saved.set(cueId, text);
      },
      findCueLine: async (cueId) => {
        const line = LINES.find((candidate) => candidate.cueId === cueId);
        if (!line) return null;
        const stored = saved.get(cueId);
        return {
          cueId,
          text: line.text,
          translation: line.translation ?? stored ?? null,
          translationSource: line.translation ? "subtitle_pt" : stored ? "llm" : null,
        };
      },
    });

    expect(await translateCue({ userId: "ana", cueId: "cue-1", pair: PAIR })).toEqual({
      text: "Não. Eu paguei a conta, feito um idiota.",
      source: "subtitle_pt",
    });
    expect(llm.translationCalls).toBe(0);

    expect(await translateCue({ userId: "ana", cueId: "cue-3", pair: PAIR })).toEqual({
      text: "Promete?",
      source: "llm",
    });
    expect(await translateCue({ userId: "lucas", cueId: "cue-3", pair: PAIR })).toEqual({
      text: "Promete?",
      source: "llm",
    });
    expect(llm.translationCalls).toBe(1);
    await expect(translateCue({ userId: "ana", cueId: "nao-existe", pair: PAIR })).rejects.toMatchObject({
      code: "CUE_NOT_FOUND",
    });
  });
});
