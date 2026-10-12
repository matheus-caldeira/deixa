import type { CefrLevel } from "@/shared/levels";
import { levelFitScore } from "./learner";
import { cosine, type Vector } from "./vectors";

export type RankableWork = {
  workKey: string;
  vector: Vector;
  levelMin: CefrLevel;
  levelMax: CefrLevel;
  popularity: number;
};

export type RankedWork = { workKey: string; score: number; similarity: number; closestIndex: number | null };

const TASTE_WEIGHT = 0.6;
const LEVEL_WEIGHT = 0.3;
const POPULARITY_WEIGHT = 0.1;
const DISMISSED_PENALTY = 0.5;
const DISMISSED_THRESHOLD = 0.6;

function closest(
  vector: Vector,
  references: readonly Vector[],
): { index: number | null; similarity: number } {
  let best = { index: null as number | null, similarity: 0 };
  references.forEach((reference, index) => {
    const similarity = cosine(vector, reference);
    if (best.index === null || similarity > best.similarity) best = { index, similarity };
  });
  return best;
}

export function rankWorks(input: {
  taste: Vector | null;
  targetIndex: number;
  works: readonly RankableWork[];
  liked: readonly Vector[];
  dismissed: readonly Vector[];
}): RankedWork[] {
  const topPopularity = Math.max(1, ...input.works.map((work) => work.popularity));
  return input.works
    .map((work) => {
      const similarity = input.taste ? Math.max(0, cosine(work.vector, input.taste)) : 0;
      const rejected = closest(work.vector, input.dismissed).similarity;
      const penalty =
        rejected > DISMISSED_THRESHOLD ? (rejected - DISMISSED_THRESHOLD) * DISMISSED_PENALTY : 0;
      const score =
        TASTE_WEIGHT * similarity +
        LEVEL_WEIGHT * levelFitScore(input.targetIndex, work.levelMin, work.levelMax) +
        POPULARITY_WEIGHT * (work.popularity / topPopularity) -
        penalty;
      return {
        workKey: work.workKey,
        score,
        similarity,
        closestIndex: closest(work.vector, input.liked).index,
      };
    })
    .sort((left, right) => right.score - left.score || left.workKey.localeCompare(right.workKey));
}
