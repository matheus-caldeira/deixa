import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import type { CefrLevel } from "@/shared/levels";
import { localDateKey, startOfLocalDay } from "@/shared/time";
import {
  PASS_ACCURACY,
  accuracyOf,
  gradeAnswer,
  isGradable,
  lessonXp,
  type Answer,
  type Exercise,
} from "../domain/exercises";
import { assemblePlan, fallbackPlan, type LessonPlan, type PlanProvider } from "../domain/plan";
import { nodeStates, trailProgressPercent, type NodeState, type TrailLine } from "../domain/trail";

export type LessonAttempt = {
  id: string;
  userId: string;
  episodeId: string;
  nodeIndex: number;
  level: CefrLevel;
  correct: number;
  total: number;
  xp: number;
  seconds: number;
  replay: boolean;
  passed: boolean;
  createdAt: Date;
};

export interface StudyRepository {
  listAttempts(
    userId: string,
    episodeId: string,
    level: CefrLevel,
  ): Promise<{ nodeIndex: number; passed: boolean; createdAt: Date }[]>;
  saveAttempt(attempt: LessonAttempt): Promise<void>;
}

export type StoredPlan = {
  status: "PENDING" | "READY" | "FAILED";
  plan: LessonPlan | null;
  failureReason: string | null;
  updatedAt: Date;
};

export interface PlanRepository {
  find(episodeId: string, level: CefrLevel): Promise<StoredPlan | null>;
  markPending(input: {
    id: string;
    episodeId: string;
    level: CefrLevel;
    requestedBy: string;
    now: Date;
  }): Promise<void>;
  saveReady(input: {
    id: string;
    episodeId: string;
    level: CefrLevel;
    plan: LessonPlan;
    now: Date;
  }): Promise<void>;
  markFailed(input: { episodeId: string; level: CefrLevel; reason: string; now: Date }): Promise<void>;
}

export type PlannerLine = { index: number; english: string; portuguese: string | null };

export interface LessonPlanner {
  readonly name: PlanProvider;
  plan(input: { level: CefrLevel; lines: PlannerLine[] }): Promise<unknown>;
}

export type StudyCollaborators = {
  loadLines: (episodeId: string) => Promise<TrailLine[] | null>;
  awardXp: (input: { userId: string; source: string; sourceId: string; amount: number }) => Promise<void>;
  saveProgress: (userId: string, episodeId: string, percent: number) => Promise<void>;
  queueForReview: (
    userId: string,
    episodeId: string,
    items: { cueId: string; translation: string | null }[],
  ) => Promise<number>;
  resolvePlanner: (userId: string) => Promise<LessonPlanner | null>;
  notify: (input: {
    userId: string;
    kind: "trail_ready" | "trail_failed";
    title: string;
    body: string;
    href: string;
  }) => Promise<void>;
};

type Deps = StudyCollaborators & {
  study: StudyRepository;
  plans: PlanRepository;
  clock: Clock;
  ids: IdGenerator;
};

export const PLAN_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_LESSON_SECONDS = 3600;
const PLAN_FAILURE = "Não foi possível montar a trilha com IA. Tente de novo.";

export type PlanJob = { userId: string; episodeId: string; level: CefrLevel; episodeLabel: string };
export type PlanStatus =
  { status: "READY" } | { status: "PENDING"; job: PlanJob | null } | { status: "FAILED"; message: string };

export type TrailView = {
  episodeId: string;
  progressPercent: number;
  generatedByAi: boolean;
  nodes: {
    index: number;
    startMs: number;
    title: string;
    icon: "quote" | "ear" | "pen" | "chest";
    state: NodeState;
  }[];
  currentIndex: number | null;
};

export type LessonView = {
  nodeIndex: number;
  title: string;
  isFinal: boolean;
  replay: boolean;
  exercises: Exercise[];
};

export type LessonResult = {
  correct: number;
  total: number;
  accuracy: number;
  requiredAccuracy: number;
  passed: boolean;
  xp: number;
  replay: boolean;
  queuedForReview: number;
  progressPercent: number;
  nextNodeIndex: number | null;
  episodeCompleted: boolean;
};

const ICONS = ["quote", "ear", "pen"] as const;

export function makeEnsurePlan(deps: Pick<Deps, "plans" | "loadLines" | "resolvePlanner" | "clock" | "ids">) {
  return async function ensurePlan(input: PlanJob & { retry?: boolean }): Promise<PlanStatus> {
    const now = deps.clock.now();
    const stored = await deps.plans.find(input.episodeId, input.level);
    if (stored?.status === "READY" && stored.plan) return { status: "READY" };
    const stale =
      stored?.status === "PENDING" && now.getTime() - stored.updatedAt.getTime() > PLAN_TIMEOUT_MS;
    if (stored?.status === "PENDING" && !stale) return { status: "PENDING", job: null };
    if (stored?.status === "FAILED" && !input.retry) {
      return { status: "FAILED", message: stored.failureReason ?? PLAN_FAILURE };
    }

    const lines = await deps.loadLines(input.episodeId);
    if (!lines || lines.length === 0) throw new AppError("EPISODE_NOT_READY");
    const planner = await deps.resolvePlanner(input.userId);
    if (!planner) {
      const plan = fallbackPlan(lines, input.level, input.episodeId);
      if (!plan) throw new AppError("EPISODE_NOT_READY");
      await deps.plans.saveReady({
        id: deps.ids.next(),
        episodeId: input.episodeId,
        level: input.level,
        plan,
        now,
      });
      return { status: "READY" };
    }
    await deps.plans.markPending({
      id: deps.ids.next(),
      episodeId: input.episodeId,
      level: input.level,
      requestedBy: input.userId,
      now,
    });
    const { retry: _retry, ...job } = input;
    return { status: "PENDING", job };
  };
}

export function makeGeneratePlan(
  deps: Pick<Deps, "plans" | "loadLines" | "resolvePlanner" | "notify" | "clock" | "ids">,
) {
  return async function generatePlan(job: PlanJob): Promise<void> {
    try {
      const lines = await deps.loadLines(job.episodeId);
      const planner = await deps.resolvePlanner(job.userId);
      if (!lines || lines.length === 0 || !planner) throw new AppError("EPISODE_NOT_READY");
      const raw = await planner.plan({
        level: job.level,
        lines: lines.map((line, index) => ({ index, english: line.text, portuguese: line.translation })),
      });
      const plan = assemblePlan({
        raw,
        lines,
        level: job.level,
        seed: job.episodeId,
        provider: planner.name,
      });
      if (!plan) throw new AppError("LLM_INVALID_OUTPUT");
      await deps.plans.saveReady({
        id: deps.ids.next(),
        episodeId: job.episodeId,
        level: job.level,
        plan,
        now: deps.clock.now(),
      });
      await deps.notify({
        userId: job.userId,
        kind: "trail_ready",
        title: "Sua trilha está pronta",
        body: `${job.episodeLabel}: ${plan.blocks.length - 1} blocos e o desafio final, no nível ${job.level}.`,
        href: "/",
      });
    } catch {
      await deps.plans.markFailed({
        episodeId: job.episodeId,
        level: job.level,
        reason: PLAN_FAILURE,
        now: deps.clock.now(),
      });
      await deps.notify({
        userId: job.userId,
        kind: "trail_failed",
        title: "Não deu para montar a trilha",
        body: `${job.episodeLabel}: ${PLAN_FAILURE}`,
        href: "/",
      });
    }
  };
}

async function loadPlanState(
  deps: Pick<Deps, "plans" | "study">,
  userId: string,
  episodeId: string,
  level: CefrLevel,
) {
  const stored = await deps.plans.find(episodeId, level);
  if (!stored || stored.status !== "READY" || !stored.plan) throw new AppError("EPISODE_NOT_READY");
  const attempts = await deps.study.listAttempts(userId, episodeId, level);
  const completed = new Set(attempts.filter((attempt) => attempt.passed).map((attempt) => attempt.nodeIndex));
  return { plan: stored.plan, attempts, completed, states: nodeStates(stored.plan.blocks.length, completed) };
}

export function makeGetTrail(deps: Pick<Deps, "plans" | "study">) {
  return async function getTrail(userId: string, episodeId: string, level: CefrLevel): Promise<TrailView> {
    const { plan, completed, states } = await loadPlanState(deps, userId, episodeId, level);
    const current = states.indexOf("current");
    return {
      episodeId,
      progressPercent: trailProgressPercent(plan.blocks.length, completed),
      generatedByAi: plan.provider === "gemini",
      currentIndex: current >= 0 ? current : null,
      nodes: plan.blocks.map((block, index) => ({
        index: block.index,
        startMs: block.startMs,
        title: block.title,
        icon: block.isFinal ? ("chest" as const) : (ICONS[index % ICONS.length] ?? "quote"),
        state: states[index] ?? "locked",
      })),
    };
  };
}

export function makeStartLesson(deps: Pick<Deps, "plans" | "study">) {
  return async function startLesson(input: {
    userId: string;
    episodeId: string;
    nodeIndex: number;
    level: CefrLevel;
  }): Promise<LessonView> {
    const { plan, states } = await loadPlanState(deps, input.userId, input.episodeId, input.level);
    const block = plan.blocks[input.nodeIndex];
    if (!block || states[input.nodeIndex] === "locked") {
      throw new AppError("EPISODE_NOT_READY", "Conclua o bloco anterior para liberar este.");
    }
    return {
      nodeIndex: block.index,
      title: block.title,
      isFinal: block.isFinal,
      replay: states[input.nodeIndex] === "done",
      exercises: block.exercises,
    };
  };
}

export function makeCompleteLesson(deps: Deps) {
  return async function completeLesson(input: {
    userId: string;
    episodeId: string;
    nodeIndex: number;
    level: CefrLevel;
    timezone: string;
    answers: Answer[];
    seconds: number;
  }): Promise<LessonResult> {
    const { plan, attempts, completed, states } = await loadPlanState(
      deps,
      input.userId,
      input.episodeId,
      input.level,
    );
    const block = plan.blocks[input.nodeIndex];
    if (!block || states[input.nodeIndex] === "locked") throw new AppError("EPISODE_NOT_READY");
    const { exercises } = block;
    if (exercises.length === 0 || input.answers.length !== exercises.length)
      throw new AppError("INVALID_INPUT");

    const outcomes = exercises.map((exercise, index) => ({
      exercise,
      gradable: isGradable(exercise),
      right: gradeAnswer(exercise, input.answers[index] ?? null),
    }));
    const graded = outcomes.filter((outcome) => outcome.gradable);
    const correct = graded.filter((outcome) => outcome.right).length;
    const total = graded.length;
    const accuracy = accuracyOf(correct, total);
    const passed = accuracy >= PASS_ACCURACY;

    const now = deps.clock.now();
    const replay = states[input.nodeIndex] === "done";
    const dayStart = startOfLocalDay(now, input.timezone);
    const paidReplaysToday = attempts.filter(
      (attempt) => attempt.nodeIndex === input.nodeIndex && attempt.passed && attempt.createdAt >= dayStart,
    ).length;
    const xp = lessonXp({ correct, total, replay, replaysToday: replay ? paidReplaysToday : 0 });

    await deps.study.saveAttempt({
      id: deps.ids.next(),
      userId: input.userId,
      episodeId: input.episodeId,
      nodeIndex: input.nodeIndex,
      level: input.level,
      correct,
      total,
      xp,
      seconds: Math.max(0, Math.min(MAX_LESSON_SECONDS, Math.round(input.seconds))),
      replay,
      passed,
      createdAt: now,
    });

    const nodeKey = `${input.episodeId}:${input.level}:${input.nodeIndex}`;
    const sourceId = replay
      ? `${nodeKey}:${localDateKey(now, input.timezone)}:repeticao-${paidReplaysToday + 1}`
      : `${nodeKey}:primeira`;
    if (xp > 0) await deps.awardXp({ userId: input.userId, source: "lesson", sourceId, amount: xp });

    const nowCompleted = passed ? new Set([...completed, input.nodeIndex]) : completed;
    const progressPercent = trailProgressPercent(plan.blocks.length, nowCompleted);
    if (passed) await deps.saveProgress(input.userId, input.episodeId, progressPercent);

    const wrong = new Map<string, string | null>();
    for (const outcome of graded) {
      if (!outcome.right) wrong.set(outcome.exercise.cueId, outcome.exercise.translation);
    }
    const queuedForReview =
      wrong.size > 0
        ? await deps.queueForReview(
            input.userId,
            input.episodeId,
            [...wrong].map(([cueId, translation]) => ({ cueId, translation })),
          )
        : 0;
    const next = nodeStates(plan.blocks.length, nowCompleted).indexOf("current");

    return {
      correct,
      total,
      accuracy,
      requiredAccuracy: PASS_ACCURACY,
      passed,
      xp,
      replay,
      queuedForReview,
      progressPercent,
      nextNodeIndex: next >= 0 ? next : null,
      episodeCompleted: passed && block.isFinal,
    };
  };
}
