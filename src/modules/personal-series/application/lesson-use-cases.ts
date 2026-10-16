import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import type { CefrLevel } from "@/shared/levels";
import type { LanguagePair } from "@/shared/study-languages";
import {
  PASS_ACCURACY,
  accuracyOf,
  arrangeLesson,
  buildLesson,
  gradeAnswer,
  isGradable,
  lessonXp,
  type Answer,
  type Exercise,
  type LessonResult,
  type TrailLine,
} from "@/modules/study";
import { CARDS_PER_NODE, episodeNodes, progressPercent, type EpisodeCard } from "../domain/series";
import type { OwnedEpisode, PersonalSeriesRepository } from "./ports";

const DISTRACTOR_POOL = 120;

type LessonDeps = {
  series: PersonalSeriesRepository;
  awardXp: (input: { userId: string; source: string; sourceId: string; amount: number }) => Promise<void>;
  clock: Clock;
  ids: IdGenerator;
};

type LessonInput = {
  userId: string;
  pair: LanguagePair;
  level: CefrLevel;
  episodeId: string;
  nodeIndex: number;
};

function toLine(card: EpisodeCard, sceneIndex: number): TrailLine {
  return {
    cueId: card.learningItemId,
    startMs: 0,
    text: card.term,
    sceneIndex,
    translation: card.translation,
  };
}

async function loadNode(deps: LessonDeps, input: LessonInput) {
  const episode = await deps.series.findEpisode(input.userId, input.episodeId);
  if (!episode) throw new AppError("ITEM_NOT_FOUND");
  const series = await deps.series.findSeries(input.userId, input.pair);
  if (!series || series.id !== episode.seriesId) throw new AppError("ITEM_NOT_FOUND");
  const cards = await deps.series.listEpisodeCards(episode.id, input.pair.native);
  const completed = new Set(episode.completedNodes);
  const nodes = episodeNodes(cards, completed);
  const node = nodes[input.nodeIndex];
  if (!node || node.state === "locked") throw new AppError("EPISODE_NOT_READY");
  const pool = await deps.series.listSeriesCards(series.id, input.pair.native, DISTRACTOR_POOL);
  const nodeCards = cards.slice(input.nodeIndex * CARDS_PER_NODE, (input.nodeIndex + 1) * CARDS_PER_NODE);
  const nodeLines = nodeCards.map((card) => toLine(card, input.nodeIndex));
  const lessonKey = `${episode.id}:${input.nodeIndex}:${nodeCards.map((card) => card.learningItemId).join(",")}`;
  const exercises = buildLesson({
    seed: lessonKey,
    level: input.level,
    nodeLines,
    allLines: [...nodeLines, ...pool.map((card) => toLine(card, -1))],
    idPrefix: "p",
  });
  return { episode, cards, completed, node, exercises };
}

export function makeStartPersonalLesson(deps: LessonDeps) {
  return async function startPersonalLesson(
    input: LessonInput,
  ): Promise<{ episode: OwnedEpisode; seed: string; exercises: Exercise[]; replay: boolean; title: string }> {
    const { episode, node, exercises } = await loadNode(deps, input);
    const seed = deps.ids.next();
    return {
      episode,
      seed,
      exercises: arrangeLesson(exercises, seed),
      replay: node.state === "done",
      title: node.title,
    };
  };
}

export function makeCompletePersonalLesson(deps: LessonDeps) {
  return async function completePersonalLesson(
    input: LessonInput & { seed: string; answers: Answer[] },
  ): Promise<LessonResult> {
    const { episode, cards, completed, node, exercises } = await loadNode(deps, input);
    const arranged = arrangeLesson(exercises, input.seed);
    if (arranged.length === 0 || input.answers.length !== arranged.length)
      throw new AppError("INVALID_INPUT");
    const gradable = arranged.filter(isGradable);
    const correct = arranged.filter(
      (exercise, index) => isGradable(exercise) && gradeAnswer(exercise, input.answers[index] ?? null),
    ).length;
    const accuracy = accuracyOf(correct, gradable.length);
    const passed = accuracy >= PASS_ACCURACY;
    const replay = node.state === "done";
    let xp = 0;
    if (passed && !replay) {
      await deps.series.completeNode(episode.id, input.nodeIndex, deps.clock.now());
      completed.add(input.nodeIndex);
      xp = lessonXp({ correct, total: gradable.length, replay: false, replaysToday: 0 });
      await deps.awardXp({
        userId: input.userId,
        source: "personal_lesson",
        sourceId: `${episode.id}:${input.nodeIndex}`,
        amount: xp,
      });
    }
    const nodes = episodeNodes(cards, completed);
    const next = nodes.find((candidate) => candidate.state === "current");
    return {
      correct,
      total: gradable.length,
      accuracy,
      requiredAccuracy: PASS_ACCURACY,
      passed,
      xp,
      replay,
      queuedForReview: 0,
      progressPercent: progressPercent(cards.length, completed),
      nextNodeIndex: next?.index ?? null,
      episodeCompleted: nodes.length > 0 && nodes.every((candidate) => candidate.state === "done"),
    };
  };
}
