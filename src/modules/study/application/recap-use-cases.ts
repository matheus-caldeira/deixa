import type { Clock } from "@/shared/clock";
import { AppError } from "@/shared/errors";
import type { IdGenerator } from "@/shared/ids";
import type { CefrLevel } from "@/shared/levels";
import { pairKey, type LanguagePair } from "@/shared/study-languages";
import { MS_PER_DAY } from "@/shared/time";
import {
  PASS_ACCURACY,
  accuracyOf,
  arrangeLesson,
  gradeAnswer,
  isGradable,
  lessonXp,
  type Answer,
  type Exercise,
} from "../domain/exercises";
import {
  RECAP_INTERVAL_DAYS,
  RECAP_STEPS,
  advanceRecap,
  firstRecapDue,
  isRecapDue,
  type Recap,
  type RecapSource,
} from "../domain/recap";
import type { LessonResult } from "./study-use-cases";

export interface RecapRepository {
  list(userId: string, pair: string): Promise<Recap[]>;
  find(userId: string, pair: string, recapId: string): Promise<Recap | null>;
  ensure(
    rows: { id: string; userId: string; source: RecapSource; episodeId: string; pair: string; dueAt: Date }[],
    now: Date,
  ): Promise<void>;
  saveStep(userId: string, recapId: string, step: number, dueAt: Date | null, now: Date): Promise<void>;
}

export type RecapLabel =
  | { kind: "catalog"; mediaType: "series" | "movie"; season: number; episode: number }
  | { kind: "personal"; level: string; episode: number };

export type RecapInfo = {
  workTitle: string;
  label: RecapLabel;
  title: string;
  summary: string;
  cards: number;
};

export type RecapCollaborators = {
  completedEpisodes: (
    userId: string,
    pair: LanguagePair,
  ) => Promise<{ source: RecapSource; episodeId: string }[]>;
  describe: (
    userId: string,
    pair: LanguagePair,
    source: RecapSource,
    episodeId: string,
  ) => Promise<RecapInfo | null>;
  material: (input: {
    userId: string;
    pair: LanguagePair;
    level: CefrLevel;
    source: RecapSource;
    episodeId: string;
    seed: string;
  }) => Promise<Exercise[]>;
};

type RecapDeps = RecapCollaborators & {
  recaps: RecapRepository;
  awardXp: (input: { userId: string; source: string; sourceId: string; amount: number }) => Promise<void>;
  clock: Clock;
  ids: IdGenerator;
};

export type RecapEntry = Recap & { due: boolean; inDays: number; info: RecapInfo };

async function syncRecaps(deps: RecapDeps, userId: string, pair: LanguagePair): Promise<Recap[]> {
  const key = pairKey(pair);
  const [known, completed] = await Promise.all([
    deps.recaps.list(userId, key),
    deps.completedEpisodes(userId, pair),
  ]);
  const existing = new Set(known.map((recap) => `${recap.source}:${recap.episodeId}`));
  const missing = completed.filter((entry) => !existing.has(`${entry.source}:${entry.episodeId}`));
  if (missing.length === 0) return known;
  const now = deps.clock.now();
  await deps.recaps.ensure(
    missing.map((entry) => ({
      id: deps.ids.next(),
      userId,
      source: entry.source,
      episodeId: entry.episodeId,
      pair: key,
      dueAt: firstRecapDue(now),
    })),
    now,
  );
  return deps.recaps.list(userId, key);
}

export function makeListRecaps(deps: RecapDeps) {
  return async function listRecaps(input: { userId: string; pair: LanguagePair }): Promise<RecapEntry[]> {
    const recaps = (await syncRecaps(deps, input.userId, input.pair)).filter((recap) => recap.dueAt !== null);
    const now = deps.clock.now();
    const entries = await Promise.all(
      recaps.map(async (recap) => {
        const info = await deps.describe(input.userId, input.pair, recap.source, recap.episodeId);
        const inDays = Math.max(1, Math.ceil(((recap.dueAt?.getTime() ?? 0) - now.getTime()) / MS_PER_DAY));
        return info ? [{ ...recap, due: isRecapDue(recap, now), inDays, info }] : [];
      }),
    );
    return entries
      .flat()
      .sort((a, b) => Number(b.due) - Number(a.due) || (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0));
  };
}

export function makeCountDueRecaps(deps: RecapDeps) {
  return async function countDueRecaps(input: { userId: string; pair: LanguagePair }): Promise<number> {
    const now = deps.clock.now();
    return (await syncRecaps(deps, input.userId, input.pair)).filter((recap) => isRecapDue(recap, now))
      .length;
  };
}

type RecapInput = { userId: string; pair: LanguagePair; level: CefrLevel; recapId: string };

async function loadRecap(deps: RecapDeps, input: RecapInput) {
  const recap = await deps.recaps.find(input.userId, pairKey(input.pair), input.recapId);
  if (!recap) throw new AppError("ITEM_NOT_FOUND");
  const info = await deps.describe(input.userId, input.pair, recap.source, recap.episodeId);
  if (!info) throw new AppError("ITEM_NOT_FOUND");
  const material = await deps.material({
    userId: input.userId,
    pair: input.pair,
    level: input.level,
    source: recap.source,
    episodeId: recap.episodeId,
    seed: `${recap.id}:${recap.step}`,
  });
  return { recap, info, material };
}

export function makeStartRecap(deps: RecapDeps) {
  return async function startRecap(input: RecapInput) {
    const { recap, info, material } = await loadRecap(deps, input);
    const seed = deps.ids.next();
    return {
      recap,
      info,
      seed,
      step: Math.min(recap.step, RECAP_STEPS - 1),
      due: isRecapDue(recap, deps.clock.now()),
      exercises: arrangeLesson(material, seed),
    };
  };
}

export function makeCompleteRecap(deps: RecapDeps) {
  return async function completeRecap(
    input: RecapInput & { seed: string; answers: Answer[] },
  ): Promise<LessonResult & { recapNextInDays: number | null }> {
    const { recap, material } = await loadRecap(deps, input);
    const exercises = arrangeLesson(material, input.seed);
    if (exercises.length === 0 || input.answers.length !== exercises.length)
      throw new AppError("INVALID_INPUT");
    const gradable = exercises.filter(isGradable);
    const correct = exercises.filter(
      (exercise, index) => isGradable(exercise) && gradeAnswer(exercise, input.answers[index] ?? null),
    ).length;
    const accuracy = accuracyOf(correct, gradable.length);
    const passed = accuracy >= PASS_ACCURACY;
    const now = deps.clock.now();
    const due = isRecapDue(recap, now);
    let xp = 0;
    let step = recap.step;
    if (passed && due) {
      const next = advanceRecap(recap.step, now);
      step = next.step;
      await deps.recaps.saveStep(input.userId, recap.id, next.step, next.dueAt, now);
      xp = lessonXp({ correct, total: gradable.length, replay: false, replaysToday: 0 });
      await deps.awardXp({
        userId: input.userId,
        source: "recap",
        sourceId: `${recap.id}:${recap.step}`,
        amount: xp,
      });
    }
    return {
      correct,
      total: gradable.length,
      accuracy,
      requiredAccuracy: PASS_ACCURACY,
      passed,
      xp,
      replay: !due,
      queuedForReview: 0,
      progressPercent: Math.round((Math.min(step, RECAP_STEPS) / RECAP_STEPS) * 100),
      nextNodeIndex: null,
      episodeCompleted: false,
      recapNextInDays: passed && due ? (RECAP_INTERVAL_DAYS[step] ?? null) : null,
    };
  };
}
