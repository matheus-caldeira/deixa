import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import type { CefrLevel } from "@/shared/levels";
import { localDateKey, startOfLocalDay } from "@/shared/time";
import { buildLesson, gradeAnswer, lessonXp, type Answer, type Exercise } from "../domain/exercises";
import {
  buildTrail,
  nodeStates,
  trailProgressPercent,
  type NodeState,
  type TrailLine,
  type TrailNode,
} from "../domain/trail";

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
  createdAt: Date;
};

export interface StudyRepository {
  listAttempts(userId: string, episodeId: string): Promise<{ nodeIndex: number; createdAt: Date }[]>;
  saveAttempt(attempt: LessonAttempt): Promise<void>;
}

export type StudyCollaborators = {
  loadLines: (episodeId: string) => Promise<TrailLine[] | null>;
  awardXp: (input: { userId: string; source: string; sourceId: string; amount: number }) => Promise<void>;
  saveProgress: (userId: string, episodeId: string, percent: number) => Promise<void>;
  queueForReview: (userId: string, episodeId: string, cueIds: string[]) => Promise<number>;
};

type Deps = StudyCollaborators & { study: StudyRepository; clock: Clock; ids: IdGenerator };

export type TrailView = {
  episodeId: string;
  progressPercent: number;
  nodes: { index: number; startMs: number; title: string; icon: TrailNode["icon"]; state: NodeState }[];
  currentIndex: number | null;
};

export type LessonView = { nodeIndex: number; title: string; replay: boolean; exercises: Exercise[] };

export type LessonResult = {
  correct: number;
  total: number;
  accuracy: number;
  xp: number;
  replay: boolean;
  queuedForReview: number;
  progressPercent: number;
  nextNodeIndex: number | null;
};

const MAX_LESSON_SECONDS = 3600;

async function loadTrail(deps: Pick<Deps, "loadLines" | "study">, userId: string, episodeId: string) {
  const lines = await deps.loadLines(episodeId);
  if (!lines) throw new AppError("EPISODE_NOT_READY");
  const nodes = buildTrail(lines);
  const attempts = await deps.study.listAttempts(userId, episodeId);
  const completed = new Set(attempts.map((attempt) => attempt.nodeIndex));
  return { lines, nodes, attempts, completed, states: nodeStates(nodes.length, completed) };
}

export function makeGetTrail(deps: Pick<Deps, "loadLines" | "study">) {
  return async function getTrail(userId: string, episodeId: string): Promise<TrailView> {
    const { nodes, completed, states } = await loadTrail(deps, userId, episodeId);
    const current = states.indexOf("current");
    return {
      episodeId,
      progressPercent: trailProgressPercent(nodes.length, completed),
      currentIndex: current >= 0 ? current : null,
      nodes: nodes.map((node, index) => ({
        index: node.index,
        startMs: node.startMs,
        title: node.title,
        icon: node.icon,
        state: states[index] ?? "locked",
      })),
    };
  };
}

export function makeStartLesson(deps: Pick<Deps, "loadLines" | "study">) {
  return async function startLesson(input: {
    userId: string;
    episodeId: string;
    nodeIndex: number;
    level: CefrLevel;
  }): Promise<LessonView> {
    const { lines, nodes, states } = await loadTrail(deps, input.userId, input.episodeId);
    const node = nodes[input.nodeIndex];
    if (!node || states[input.nodeIndex] === "locked")
      throw new AppError("EPISODE_NOT_READY", "Conclua a cena anterior para liberar esta.");
    return {
      nodeIndex: node.index,
      title: node.title,
      replay: states[input.nodeIndex] === "done",
      exercises: buildLesson({
        seed: `${input.episodeId}:${node.index}`,
        level: input.level,
        nodeLines: node.lines,
        allLines: lines,
      }),
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
    const { lines, nodes, attempts, completed, states } = await loadTrail(
      deps,
      input.userId,
      input.episodeId,
    );
    const node = nodes[input.nodeIndex];
    if (!node || states[input.nodeIndex] === "locked") throw new AppError("EPISODE_NOT_READY");
    const exercises = buildLesson({
      seed: `${input.episodeId}:${node.index}`,
      level: input.level,
      nodeLines: node.lines,
      allLines: lines,
    });
    if (exercises.length === 0 || input.answers.length !== exercises.length)
      throw new AppError("INVALID_INPUT");

    const results = exercises.map((exercise, index) => gradeAnswer(exercise, input.answers[index] ?? null));
    const correct = results.filter(Boolean).length;
    const now = deps.clock.now();
    const replay = states[input.nodeIndex] === "done";
    const dayStart = startOfLocalDay(now, input.timezone);
    const replaysToday = attempts.filter(
      (attempt) => attempt.nodeIndex === input.nodeIndex && attempt.createdAt >= dayStart,
    ).length;
    const xp = lessonXp({
      correct,
      total: exercises.length,
      replay,
      replaysToday: replay ? replaysToday : 0,
    });

    const attemptId = deps.ids.next();
    await deps.study.saveAttempt({
      id: attemptId,
      userId: input.userId,
      episodeId: input.episodeId,
      nodeIndex: input.nodeIndex,
      level: input.level,
      correct,
      total: exercises.length,
      xp,
      seconds: Math.max(0, Math.min(MAX_LESSON_SECONDS, Math.round(input.seconds))),
      replay,
      createdAt: now,
    });
    const nodeKey = `${input.episodeId}:${input.nodeIndex}`;
    const sourceId = replay
      ? `${nodeKey}:${localDateKey(now, input.timezone)}:repeticao-${replaysToday + 1}`
      : `${nodeKey}:primeira`;
    if (xp > 0) await deps.awardXp({ userId: input.userId, source: "lesson", sourceId, amount: xp });

    const nowCompleted = new Set([...completed, input.nodeIndex]);
    const progressPercent = trailProgressPercent(nodes.length, nowCompleted);
    await deps.saveProgress(input.userId, input.episodeId, progressPercent);

    const wrongCueIds = [
      ...new Set(exercises.filter((_, index) => !results[index]).map((exercise) => exercise.cueId)),
    ];
    const queuedForReview =
      wrongCueIds.length > 0 ? await deps.queueForReview(input.userId, input.episodeId, wrongCueIds) : 0;
    const nextStates = nodeStates(nodes.length, nowCompleted);
    const next = nextStates.indexOf("current");

    return {
      correct,
      total: exercises.length,
      accuracy: Math.round((correct / exercises.length) * 100),
      xp,
      replay,
      queuedForReview,
      progressPercent,
      nextNodeIndex: next >= 0 ? next : null,
    };
  };
}
