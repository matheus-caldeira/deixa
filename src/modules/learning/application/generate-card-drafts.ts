import { AppError, isAppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import type { CefrLevel } from "@/shared/levels";
import { termFromTokens, tokenize } from "@/shared/text";
import {
  MAX_HIGHLIGHTS_PER_BATCH,
  explainedTermsSchema,
  spanKeyOf,
  type CardDraft,
  type ExplainedTerm,
  type ReusableItem,
} from "../domain/learning";
import type {
  ExplainRequestItem,
  LearningCollaborators,
  LearningRepository,
  PendingHighlight,
  ScriptLineForCards,
} from "./ports";

export type GenerationStep = { key: string; counts: Record<string, number | string> };

export type GeneratedDrafts = {
  batchId: string;
  drafts: CardDraft[];
  steps: GenerationStep[];
  llmProvider: string;
  llmCalls: number;
  translationsFromSubtitle: number;
};

type Deps = Pick<LearningCollaborators, "loadScript" | "listPendingHighlights" | "resolveLlm"> & {
  learning: LearningRepository;
  clock: Clock;
  ids: IdGenerator;
};

function termOf(highlight: PendingHighlight, line: ScriptLineForCards): string {
  if (highlight.kind === "line") return line.text;
  return termFromTokens(tokenize(line.text), highlight.startToken, highlight.endToken);
}

function draftFromReusable(
  highlight: PendingHighlight,
  line: ScriptLineForCards,
  item: ReusableItem,
): CardDraft {
  return {
    key: highlight.id,
    highlightId: highlight.id,
    cueId: highlight.cueId,
    startToken: highlight.startToken,
    endToken: highlight.endToken,
    kind: highlight.kind,
    term: item.term,
    itemType: item.itemType,
    difficulty: item.difficulty,
    meaning: item.meaning,
    meaningSource: item.meaningSource,
    pronunciation: item.pronunciation,
    exampleEnglish: item.exampleEnglish,
    examplePortuguese: item.examplePortuguese,
    lineText: line.text,
    lineTranslation: line.translation ?? item.lineTranslation,
    lineTranslationSource: line.translation ? line.translationSource : item.lineTranslationSource,
    startMs: line.startMs,
    endMs: line.endMs,
    reusedItemId: item.id,
  };
}

function draftFromSubtitleLine(
  highlight: PendingHighlight,
  line: ScriptLineForCards,
  translation: string,
  learnerLevel: CefrLevel,
): CardDraft {
  return {
    key: highlight.id,
    highlightId: highlight.id,
    cueId: highlight.cueId,
    startToken: highlight.startToken,
    endToken: highlight.endToken,
    kind: "line",
    term: line.text,
    itemType: "sentence",
    difficulty: learnerLevel,
    meaning: translation,
    meaningSource: "subtitle_pt",
    pronunciation: null,
    exampleEnglish: null,
    examplePortuguese: null,
    lineText: line.text,
    lineTranslation: translation,
    lineTranslationSource: "subtitle_pt",
    startMs: line.startMs,
    endMs: line.endMs,
    reusedItemId: null,
  };
}

function draftFromExplanation(
  highlight: PendingHighlight,
  line: ScriptLineForCards,
  term: string,
  explained: ExplainedTerm,
): CardDraft {
  const translatedByLlm = explained.lineTranslation ?? null;
  const lineTranslation = line.translation ?? translatedByLlm;
  return {
    key: highlight.id,
    highlightId: highlight.id,
    cueId: highlight.cueId,
    startToken: highlight.startToken,
    endToken: highlight.endToken,
    kind: highlight.kind,
    term,
    itemType: highlight.kind === "line" ? "sentence" : explained.itemType,
    difficulty: explained.difficulty,
    meaning: highlight.kind === "line" && lineTranslation ? lineTranslation : explained.meaning,
    meaningSource: "llm",
    pronunciation: explained.pronunciation ?? null,
    exampleEnglish: explained.exampleEnglish ?? null,
    examplePortuguese: explained.examplePortuguese ?? null,
    lineText: line.text,
    lineTranslation,
    lineTranslationSource: line.translation
      ? (line.translationSource ?? "subtitle_pt")
      : lineTranslation
        ? "llm"
        : null,
    startMs: line.startMs,
    endMs: line.endMs,
    reusedItemId: null,
  };
}

export function makeGenerateCardDrafts(deps: Deps) {
  async function explain(userId: string, learnerLevel: CefrLevel, items: ExplainRequestItem[]) {
    const provider = await deps.resolveLlm(userId);
    let raw: unknown;
    try {
      raw = await provider.explainTerms({ learnerLevel, items });
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError("LLM_FAILED");
    }
    const parsed = explainedTermsSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError("LLM_INVALID_OUTPUT", "A IA devolveu uma resposta fora do formato.");
    const byId = new Map(parsed.data.map((entry) => [entry.id, entry]));
    if (items.some((item) => !byId.has(item.id))) {
      throw new AppError("LLM_INVALID_OUTPUT", "termsMissing");
    }
    return { byId, providerName: provider.name };
  }

  return async function generateCardDrafts(input: {
    userId: string;
    episodeId: string;
    learnerLevel: CefrLevel;
    batchId?: string;
  }): Promise<GeneratedDrafts> {
    const script = await deps.loadScript(input.episodeId);
    if (!script) throw new AppError("EPISODE_NOT_READY");
    const pending = (await deps.listPendingHighlights(input.userId, input.episodeId)).slice(
      0,
      MAX_HIGHLIGHTS_PER_BATCH,
    );
    if (pending.length === 0) throw new AppError("NO_HIGHLIGHTS");

    const lineByCue = new Map(script.lines.map((line) => [line.cueId, line]));
    const reusable = new Map(
      (await deps.learning.findReusable(input.userId, input.episodeId)).map((item) => [
        spanKeyOf(item),
        item,
      ]),
    );

    const ready = new Map<string, CardDraft>();
    const toExplain: { highlight: PendingHighlight; line: ScriptLineForCards; term: string }[] = [];
    for (const highlight of pending) {
      const line = lineByCue.get(highlight.cueId);
      if (!line) continue;
      const existing = reusable.get(spanKeyOf(highlight));
      if (existing) {
        ready.set(highlight.id, draftFromReusable(highlight, line, existing));
        continue;
      }
      if (highlight.kind === "line" && line.translation && line.translationSource === "subtitle_pt") {
        ready.set(highlight.id, draftFromSubtitleLine(highlight, line, line.translation, input.learnerLevel));
        continue;
      }
      const term = termOf(highlight, line);
      if (term.length > 0) toExplain.push({ highlight, line, term });
    }

    let llmCalls = 0;
    let llmProvider = "nenhum";
    if (toExplain.length > 0) {
      const { byId, providerName } = await explain(
        input.userId,
        input.learnerLevel,
        toExplain.map(({ highlight, line, term }) => ({
          id: highlight.id,
          term,
          kind: highlight.kind,
          lineText: line.text,
          lineTranslation: line.translation,
        })),
      );
      llmCalls = 1;
      llmProvider = providerName;
      for (const { highlight, line, term } of toExplain) {
        const explained = byId.get(highlight.id);
        if (explained) ready.set(highlight.id, draftFromExplanation(highlight, line, term, explained));
      }
    }

    const drafts = pending.flatMap((highlight) => {
      const draft = ready.get(highlight.id);
      return draft ? [draft] : [];
    });
    const translationsFromSubtitle = drafts.filter(
      (draft) => draft.lineTranslationSource === "subtitle_pt",
    ).length;
    const translatedByLlm = drafts.filter((draft) => draft.lineTranslationSource === "llm").length;
    const reusedCount = drafts.filter((draft) => draft.reusedItemId !== null).length;
    const expressions = drafts.filter((draft) => draft.kind === "phrase").length;

    const batchId = input.batchId ?? deps.ids.next();
    await deps.learning.saveDraftBatch({
      id: batchId,
      userId: input.userId,
      episodeId: input.episodeId,
      drafts,
      highlightsCount: pending.length,
      llmCalls,
      llmProvider,
      now: deps.clock.now(),
    });

    return {
      batchId,
      drafts,
      llmProvider,
      llmCalls,
      translationsFromSubtitle,
      steps: [
        { key: "group", counts: { highlights: pending.length, expressions } },
        {
          key: translatedByLlm === 0 ? "translateFromSubtitle" : "translateMissing",
          counts: { fromSubtitle: translationsFromSubtitle, byLlm: translatedByLlm },
        },
        { key: "explain", counts: { reused: reusedCount, llmCalls, provider: llmProvider } },
        { key: "validate", counts: {} },
        { key: "assemble", counts: { cards: drafts.length } },
      ],
    };
  };
}
