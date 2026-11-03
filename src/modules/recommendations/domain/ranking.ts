import type { CefrLevel } from "@/shared/levels";
import { levelFitScore } from "./learner";
import { cosine, type Vector } from "./vectors";

export type RankableWork = {
  workKey: string;
  vector: Vector;
  levelMin: CefrLevel;
  levelMax: CefrLevel;
  popularity: number;
  genres: readonly string[];
};

export type RankedWork = { workKey: string; score: number; similarity: number; closestIndex: number | null };

const TASTE_WEIGHT = 0.6;
const LEVEL_WEIGHT = 0.3;
const POPULARITY_WEIGHT = 0.1;
const DISMISSED_PENALTY = 0.5;
const DISMISSED_THRESHOLD = 0.6;
export const DIVERSITY_WEIGHT = 0.3;

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

const genreSet = (genres: readonly string[]): ReadonlySet<string> =>
  new Set(genres.map((genre) => genre.trim().toLocaleLowerCase()).filter((genre) => genre.length > 0));

export function genreOverlap(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  const shared = [...left].filter((genre) => right.has(genre)).length;
  return shared / (left.size + right.size - shared);
}

export function diversifyByGenre<T extends { score: number; genres: readonly string[] }>(
  ranked: readonly T[],
  weight = DIVERSITY_WEIGHT,
): T[] {
  const remaining = ranked.map((item) => ({ item, genres: genreSet(item.genres) }));
  const chosen: { item: T; genres: ReadonlySet<string> }[] = [];
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestValue = Number.NEGATIVE_INFINITY;
    remaining.forEach((entry, index) => {
      const redundancy = Math.max(0, ...chosen.map((picked) => genreOverlap(entry.genres, picked.genres)));
      const value = (1 - weight) * entry.item.score - weight * redundancy;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    });
    const [picked] = remaining.splice(bestIndex, 1);
    if (picked) chosen.push(picked);
  }
  return chosen.map((entry) => entry.item);
}

export function rankWorks(input: {
  taste: Vector | null;
  targetIndex: number;
  works: readonly RankableWork[];
  liked: readonly Vector[];
  dismissed: readonly Vector[];
}): RankedWork[] {
  const topPopularity = Math.max(1, ...input.works.map((work) => work.popularity));
  const scored = input.works
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
        genres: work.genres,
      };
    })
    .sort((left, right) => right.score - left.score || left.workKey.localeCompare(right.workKey));
  return diversifyByGenre(scored).map(({ genres: _genres, ...ranked }) => ranked);
}
