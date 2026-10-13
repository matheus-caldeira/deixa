import { z } from "zod";
import type { WorkCandidate } from "@/modules/catalog";
import type { Clock } from "@/shared/clock";
import { AppError } from "@/shared/errors";
import { CEFR_LEVELS, levelIndex, type CefrLevel } from "@/shared/levels";
import { cleanLlmText } from "@/shared/llm-text";
import { MS_PER_DAY } from "@/shared/time";
import {
  assessLearner,
  estimateLevelRange,
  fitLabel,
  signalsFingerprint,
  type LearnerAssessment,
  type LearnerSignals,
  type StudiedWork,
} from "../domain/learner";
import { rankWorks, type RankedWork } from "../domain/ranking";
import { weightedCentroid, type Vector } from "../domain/vectors";
import type {
  CandidateSource,
  EmbeddingProvider,
  RecommendationRepository,
  RecommendationRun,
  Suggestion,
  SuggestionWriter,
  WriterInput,
  WriterName,
} from "./ports";

export const SIGNAL_WINDOW_DAYS = 30;
export const MIN_REFRESH_HOURS = 12;
export const MAX_AGE_DAYS = 7;
export const RETRY_AFTER_FAILURE_MINUTES = 60;
export const STUCK_AFTER_MINUTES = 10;
export const MANUAL_INTERVAL_SECONDS = 60;
export const MAX_SUGGESTIONS = 8;
const MIN_VISIBLE = 3;
const MAX_SEED_WORKS = 3;
const MAX_CANDIDATES = 60;
const SHORTLIST = 14;
const MAX_REASON_CHARS = 220;
const MAX_OVERVIEW_CHARS = 320;
const MAX_STUDIED_IN_PROMPT = 8;
const ADDED_WEIGHT = 0.5;
const RELATED_SIMILARITY = 0.15;
const ENGLISH = "en";
const PERCENT = 100;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_SECOND = 1000;

type Deps = {
  repository: RecommendationRepository;
  resolveCandidates: (userId: string) => Promise<CandidateSource>;
  resolveEmbedding: (userId: string) => Promise<EmbeddingProvider>;
  localEmbedding: EmbeddingProvider;
  resolveWriter: (userId: string) => Promise<SuggestionWriter | null>;
  clock: Clock;
  onFallback?: (stage: "embedding" | "writer" | "candidates", reason: string) => void;
};

export type RecommendationsView = {
  status: "ready" | "pending" | "failed" | "empty";
  items: Suggestion[];
  insight: string | null;
  writtenByAi: boolean;
  updating: boolean;
  refresh: boolean;
};

const workKeyOf = (work: { provider: string; externalId: string }): string =>
  `${work.provider}:${work.externalId}`;

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : "desconhecido");

function isDue(run: RecommendationRun | null, fingerprint: string, visible: number, now: Date): boolean {
  if (!run) return true;
  if (run.status === "RUNNING") {
    return now.getTime() - run.startedAt.getTime() > STUCK_AFTER_MINUTES * MS_PER_MINUTE;
  }
  const age = now.getTime() - (run.finishedAt ?? run.startedAt).getTime();
  if (run.status === "FAILED") return age > RETRY_AFTER_FAILURE_MINUTES * MS_PER_MINUTE;
  if (age > MAX_AGE_DAYS * MS_PER_DAY) return true;
  if (visible < MIN_VISIBLE && age > STUCK_AFTER_MINUTES * MS_PER_MINUTE) return true;
  return run.fingerprint !== fingerprint && age > MIN_REFRESH_HOURS * MS_PER_HOUR;
}

async function loadSignals(deps: Deps, userId: string, level: CefrLevel, now: Date): Promise<LearnerSignals> {
  const since = new Date(now.getTime() - SIGNAL_WINDOW_DAYS * MS_PER_DAY);
  return { level, ...(await deps.repository.loadSignals(userId, since)) };
}

export function makeGetRecommendations(deps: Deps) {
  return async function getRecommendations(input: {
    userId: string;
    level: CefrLevel;
  }): Promise<RecommendationsView> {
    const now = deps.clock.now();
    const [run, items, signals, feedback] = await Promise.all([
      deps.repository.getRun(input.userId),
      deps.repository.listSuggestions(input.userId),
      loadSignals(deps, input.userId, input.level, now),
      deps.repository.listFeedback(input.userId),
    ]);
    const refresh = isDue(run, signalsFingerprint(signals, feedback.length), items.length, now);
    const waiting = refresh || run?.status === "RUNNING";
    return {
      status:
        items.length > 0 ? "ready" : waiting ? "pending" : run?.status === "FAILED" ? "failed" : "empty",
      items,
      insight: run?.insight ?? null,
      writtenByAi: run?.writer != null && run.writer !== "local",
      updating: waiting,
      refresh,
    };
  };
}

async function gatherCandidates(
  deps: Deps,
  source: CandidateSource,
  studied: StudiedWork[],
  excluded: ReadonlySet<string>,
): Promise<WorkCandidate[]> {
  const seeds = studied
    .filter((work) => work.provider === source.name)
    .sort((left, right) => right.engagement - left.engagement)
    .slice(0, MAX_SEED_WORKS);
  const failed = (error: unknown): WorkCandidate[] => {
    deps.onFallback?.("candidates", reasonOf(error));
    return [];
  };
  const lists = await Promise.all([
    ...seeds.map((seed) => source.listRelatedWorks(seed.type, seed.externalId).catch(failed)),
    source.listPopularWorks().catch(failed),
  ]);
  const unique = new Map<string, WorkCandidate>();
  for (const work of lists.flat()) {
    const key = workKeyOf(work);
    if (excluded.has(key) || unique.has(key)) continue;
    if (work.originalLanguage !== null && work.originalLanguage !== ENGLISH) continue;
    unique.set(key, work);
  }
  return [...unique.values()].slice(0, MAX_CANDIDATES);
}

const documentOf = (work: { title: string; overview: string; genres?: readonly string[] }): string =>
  [work.title, (work.genres ?? []).join(", "), work.overview].filter((part) => part.length > 0).join(". ");

async function embedWith(
  deps: Deps,
  provider: EmbeddingProvider,
  documents: ReadonlyMap<string, string>,
  now: Date,
): Promise<Map<string, Vector>> {
  const keys = [...documents.keys()];
  const known = await deps.repository.getEmbeddings(provider.model, keys);
  const missing = keys.filter((key) => !known.has(key));
  if (missing.length === 0) return known;
  const vectors = await provider.embed(missing.map((key) => documents.get(key) ?? ""));
  if (vectors.length !== missing.length) throw new AppError("LLM_INVALID_OUTPUT");
  const fresh = missing.map((workKey, index) => ({ workKey, vector: vectors[index] ?? [] }));
  await deps.repository.saveEmbeddings(provider.model, fresh, now);
  for (const entry of fresh) known.set(entry.workKey, entry.vector);
  return known;
}

async function embedDocuments(
  deps: Deps,
  userId: string,
  documents: ReadonlyMap<string, string>,
  now: Date,
): Promise<{ vectors: Map<string, Vector>; provider: EmbeddingProvider }> {
  const preferred = await deps.resolveEmbedding(userId);
  try {
    return { vectors: await embedWith(deps, preferred, documents, now), provider: preferred };
  } catch (error) {
    if (preferred.name === deps.localEmbedding.name) throw error;
    deps.onFallback?.("embedding", reasonOf(error));
    return {
      vectors: await embedWith(deps, deps.localEmbedding, documents, now),
      provider: deps.localEmbedding,
    };
  }
}

const levelSchema = z.enum(CEFR_LEVELS);
const writerOutputSchema = z.object({
  items: z.array(
    z.object({
      key: z.string(),
      reason: z.string(),
      levelMin: levelSchema.optional().catch(undefined),
      levelMax: levelSchema.optional().catch(undefined),
    }),
  ),
});

type Draft = { work: WorkCandidate; ranked: RankedWork; levels: readonly [CefrLevel, CefrLevel] };

function localReason(draft: Draft, studied: StudiedWork[], assessment: LearnerAssessment): string {
  const related =
    draft.ranked.closestIndex !== null && draft.ranked.similarity >= RELATED_SIMILARITY
      ? studied[draft.ranked.closestIndex]
      : undefined;
  const opening = related
    ? `Tem a ver com ${related.title}, que você estudou`
    : "Está em alta entre obras em inglês";
  const fit = fitLabel(assessment.targetIndex, draft.levels[0], draft.levels[1]);
  if (fit === "challenging") return `${opening}, e o nível estimado puxa um pouco acima do seu.`;
  if (fit === "easy") return `${opening}, e o nível estimado é tranquilo para você.`;
  return `${opening}, e o nível estimado combina com o seu.`;
}

const MAX_TITLE_CHARS = 80;
const MAX_TERM_CHARS = 40;
const MAX_GENRE_CHARS = 30;

const promptText = (value: string, maxLength: number): string =>
  cleanLlmText(value.slice(0, maxLength), maxLength) ?? "";

const promptList = (values: readonly string[], maxLength: number): string[] =>
  values.map((value) => promptText(value, maxLength)).filter((value) => value.length > 0);

const toPercent = (value: number | null): number | null =>
  value === null ? null : Math.round(value * PERCENT);

function writerInput(
  signals: LearnerSignals,
  assessment: LearnerAssessment,
  shortlist: Draft[],
  studied: StudiedWork[],
): WriterInput {
  return {
    learner: {
      level: signals.level,
      challenge: assessment.challenge,
      accuracyPercent: toPercent(assessment.accuracy),
      forgottenPercent: toPercent(assessment.againRate),
      marksPerHundredLines:
        assessment.marksPerHundred === null ? null : Math.round(assessment.marksPerHundred),
      studied: promptList(
        studied.slice(0, MAX_STUDIED_IN_PROMPT).map((work) => work.title),
        MAX_TITLE_CHARS,
      ),
      hardTerms: promptList(signals.hardTerms, MAX_TERM_CHARS),
    },
    candidates: shortlist.map(({ work, ranked }) => ({
      key: workKeyOf(work),
      title: promptText(work.originalTitle || work.title, MAX_TITLE_CHARS),
      type: work.type,
      year: work.year,
      genres: promptList(work.genres, MAX_GENRE_CHARS),
      overview: promptText(work.overview, MAX_OVERVIEW_CHARS),
      closestStudied:
        ranked.closestIndex === null
          ? null
          : promptText(studied[ranked.closestIndex]?.title ?? "", MAX_TITLE_CHARS) || null,
    })),
    limit: MAX_SUGGESTIONS,
  };
}

type Written = { draft: Draft; reason: string; levels: readonly [CefrLevel, CefrLevel] };

function readWriterOutput(output: unknown, shortlist: Draft[]): Written[] {
  const parsed = writerOutputSchema.safeParse(output);
  if (!parsed.success) throw new AppError("LLM_INVALID_OUTPUT");
  const byKey = new Map(shortlist.map((draft) => [workKeyOf(draft.work), draft]));
  const written: Written[] = [];
  for (const item of parsed.data.items) {
    const draft = byKey.get(item.key);
    const reason = cleanLlmText(item.reason, MAX_REASON_CHARS);
    if (!draft || !reason) continue;
    byKey.delete(item.key);
    const ordered =
      item.levelMin && item.levelMax && levelIndex(item.levelMin) <= levelIndex(item.levelMax)
        ? ([item.levelMin, item.levelMax] as const)
        : draft.levels;
    written.push({ draft, reason, levels: ordered });
  }
  return written;
}

async function writeSuggestions(
  deps: Deps,
  userId: string,
  signals: LearnerSignals,
  assessment: LearnerAssessment,
  shortlist: Draft[],
  studied: StudiedWork[],
): Promise<{ written: Written[]; writer: WriterName }> {
  const local = (drafts: Draft[]): Written[] =>
    drafts.map((draft) => ({
      draft,
      reason: localReason(draft, studied, assessment),
      levels: draft.levels,
    }));
  let fromAi: Written[] = [];
  let writerName: WriterName = "local";
  try {
    const writer = await deps.resolveWriter(userId);
    if (writer) {
      writerName = writer.name;
      fromAi = readWriterOutput(
        await writer.write(writerInput(signals, assessment, shortlist, studied)),
        shortlist,
      );
    }
  } catch (error) {
    deps.onFallback?.("writer", reasonOf(error));
  }
  const chosen = new Set(fromAi.map((item) => item.draft));
  const filler = local(shortlist.filter((draft) => !chosen.has(draft)));
  return {
    written: [...fromAi, ...filler].slice(0, MAX_SUGGESTIONS),
    writer: fromAi.length > 0 ? writerName : "local",
  };
}

export function makeRefreshRecommendations(deps: Deps) {
  return async function refreshRecommendations(input: {
    userId: string;
    level: CefrLevel;
  }): Promise<{ refreshed: boolean }> {
    const startedAt = deps.clock.now();
    const previous = await deps.repository.getRun(input.userId);
    const lastFinish = previous?.finishedAt?.getTime() ?? 0;
    if (startedAt.getTime() - lastFinish < MANUAL_INTERVAL_SECONDS * MS_PER_SECOND) {
      return { refreshed: false };
    }
    const stuckBefore = new Date(startedAt.getTime() - STUCK_AFTER_MINUTES * MS_PER_MINUTE);
    if (!(await deps.repository.claimRun(input.userId, startedAt, stuckBefore))) return { refreshed: false };

    try {
      const [signals, feedback] = await Promise.all([
        loadSignals(deps, input.userId, input.level, startedAt),
        deps.repository.listFeedback(input.userId),
      ]);
      const assessment = assessLearner(signals);
      const studied = [...signals.works].sort((left, right) => right.engagement - left.engagement);
      const excluded = new Set([
        ...studied.map((work) => work.workKey),
        ...feedback.map((entry) => entry.workKey),
      ]);
      const candidates = await gatherCandidates(
        deps,
        await deps.resolveCandidates(input.userId),
        studied,
        excluded,
      );

      const documents = new Map<string, string>();
      for (const work of candidates) documents.set(workKeyOf(work), documentOf(work));
      for (const work of studied) documents.set(work.workKey, documentOf(work));
      const { vectors, provider } =
        candidates.length > 0
          ? await embedDocuments(deps, input.userId, documents, startedAt)
          : { vectors: new Map<string, Vector>(), provider: deps.localEmbedding };
      const feedbackVectors = await deps.repository.getEmbeddings(
        provider.model,
        feedback.map((entry) => entry.workKey),
      );
      const dismissed = feedback.flatMap((entry) => {
        const vector = feedbackVectors.get(entry.workKey);
        return entry.verdict === "dismissed" && vector ? [vector] : [];
      });
      const added = feedback.flatMap((entry) => {
        const vector = feedbackVectors.get(entry.workKey);
        return entry.verdict === "added" && vector ? [{ vector, weight: ADDED_WEIGHT }] : [];
      });
      const studiedVectors = studied.map((work) => vectors.get(work.workKey) ?? []);
      const taste = weightedCentroid([
        ...studied.map((work, index) => ({ vector: studiedVectors[index] ?? [], weight: work.engagement })),
        ...added,
      ]);

      const levelsByKey = new Map(
        candidates.map((work) => [workKeyOf(work), estimateLevelRange(work.genres)] as const),
      );
      const ranked = rankWorks({
        taste,
        targetIndex: assessment.targetIndex,
        liked: studiedVectors,
        dismissed,
        works: candidates.map((work) => {
          const key = workKeyOf(work);
          const [levelMin, levelMax] = levelsByKey.get(key) ?? estimateLevelRange([]);
          return {
            workKey: key,
            vector: vectors.get(key) ?? [],
            levelMin,
            levelMax,
            popularity: work.popularity,
          };
        }),
      });
      const candidateByKey = new Map(candidates.map((work) => [workKeyOf(work), work]));
      const shortlist = ranked.slice(0, SHORTLIST).flatMap((entry) => {
        const work = candidateByKey.get(entry.workKey);
        const levels = levelsByKey.get(entry.workKey);
        return work && levels ? [{ work, ranked: entry, levels }] : [];
      });

      const { written, writer } = await writeSuggestions(
        deps,
        input.userId,
        signals,
        assessment,
        shortlist,
        studied,
      );
      const finishedAt = deps.clock.now();
      await deps.repository.replaceSuggestions(
        input.userId,
        written.map(({ draft, reason, levels }, position) => ({
          workKey: workKeyOf(draft.work),
          provider: draft.work.provider,
          externalId: draft.work.externalId,
          type: draft.work.type,
          title: draft.work.title,
          originalTitle: draft.work.originalTitle,
          overview: draft.work.overview,
          year: draft.work.year,
          posterPath: draft.work.posterPath,
          genres: draft.work.genres,
          levelMin: levels[0],
          levelMax: levels[1],
          score: draft.ranked.score,
          reason,
          position,
        })),
        finishedAt,
      );
      await deps.repository.finishRun(
        input.userId,
        {
          status: "READY",
          fingerprint: signalsFingerprint(signals, feedback.length),
          writer,
          embedding: provider.name,
          insight: assessment.insight,
          failureReason: null,
        },
        finishedAt,
      );
      return { refreshed: true };
    } catch (error) {
      await deps.repository.finishRun(
        input.userId,
        {
          status: "FAILED",
          fingerprint: null,
          writer: null,
          embedding: null,
          insight: previous?.insight ?? null,
          failureReason: reasonOf(error).slice(0, MAX_REASON_CHARS),
        },
        deps.clock.now(),
      );
      throw error;
    }
  };
}

export function makeDismissRecommendation(deps: Pick<Deps, "repository" | "clock">) {
  return async function dismissRecommendation(input: { userId: string; workKey: string }): Promise<void> {
    const suggestion = await deps.repository.findSuggestion(input.userId, input.workKey);
    if (!suggestion) throw new AppError("MEDIA_NOT_FOUND");
    await deps.repository.saveFeedback(input.userId, input.workKey, "dismissed", deps.clock.now());
    await deps.repository.removeSuggestion(input.userId, input.workKey);
  };
}

export function makeAcceptRecommendation(deps: Pick<Deps, "repository" | "clock">) {
  return async function acceptRecommendation(input: {
    userId: string;
    workKey: string;
  }): Promise<Suggestion> {
    const suggestion = await deps.repository.findSuggestion(input.userId, input.workKey);
    if (!suggestion) throw new AppError("MEDIA_NOT_FOUND");
    await deps.repository.saveFeedback(input.userId, input.workKey, "added", deps.clock.now());
    await deps.repository.removeSuggestion(input.userId, input.workKey);
    return suggestion;
  };
}
