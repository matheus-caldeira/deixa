import { z } from "zod";
import type { StudyLanguage } from "@/shared/study-languages";
import { CEFR_LEVELS, levelIndex, type CefrLevel, type LevelFit } from "@/shared/levels";

export type StudiedWork = {
  workKey: string;
  provider: string;
  externalId: string;
  type: "series" | "movie";
  title: string;
  overview: string;
  genres: string[];
  engagement: number;
};

export type LearnerSignals = {
  level: CefrLevel;
  language: StudyLanguage;
  works: StudiedWork[];
  lessons: { answers: number; correct: number; attempts: number; failed: number };
  reviews: { total: number; again: number };
  reading: { marks: number; cuesRead: number };
  hardTerms: string[];
};

export type Challenge = "easier" | "steady" | "harder";

export type LearnerAssessment = {
  challenge: Challenge;
  targetIndex: number;
  accuracy: number | null;
  againRate: number | null;
  marksPerHundred: number | null;
  insight: LearnerInsight;
};

export const MIN_ANSWERS = 20;
export const MIN_REVIEWS = 15;
export const MIN_CUES_READ = 50;
const HIGH_ACCURACY = 0.85;
const LOW_ACCURACY = 0.6;
const LOW_AGAIN_RATE = 0.15;
const HIGH_AGAIN_RATE = 0.4;
const FEW_MARKS_PER_HUNDRED = 4;
const MANY_MARKS_PER_HUNDRED = 15;
const CHALLENGE_SHIFT = 0.5;
const PERCENT = 100;
const FIT_LOSS_PER_LEVEL = 0.35;

const ratio = (part: number, whole: number, minimum: number): number | null =>
  whole >= minimum ? part / whole : null;

function decideChallenge(
  accuracy: number | null,
  againRate: number | null,
  marksPerHundred: number | null,
): Challenge {
  const struggling =
    (accuracy !== null && accuracy < LOW_ACCURACY) ||
    (againRate !== null && againRate > HIGH_AGAIN_RATE) ||
    (marksPerHundred !== null && marksPerHundred > MANY_MARKS_PER_HUNDRED);
  if (struggling) return "easier";
  const evidence = [
    accuracy === null ? null : accuracy >= HIGH_ACCURACY,
    againRate === null ? null : againRate <= LOW_AGAIN_RATE,
    marksPerHundred === null ? null : marksPerHundred <= FEW_MARKS_PER_HUNDRED,
  ].filter((signal): signal is boolean => signal !== null);
  return evidence.length > 0 && evidence.every(Boolean) ? "harder" : "steady";
}

export const learnerInsightSchema = z.object({
  challenge: z.enum(["easier", "steady", "harder"]),
  accuracyPercent: z.number().nullable(),
  againPercent: z.number().nullable(),
  marksPerHundred: z.number().nullable(),
});
export type LearnerInsight = z.infer<typeof learnerInsightSchema>;

export function parseLearnerInsight(text: string | null): LearnerInsight | null {
  if (!text) return null;
  try {
    const parsed = learnerInsightSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function describe(
  challenge: Challenge,
  accuracy: number | null,
  againRate: number | null,
  marksPerHundred: number | null,
): LearnerInsight {
  return {
    challenge,
    accuracyPercent: accuracy === null ? null : Math.round(accuracy * PERCENT),
    againPercent: againRate === null ? null : Math.round(againRate * PERCENT),
    marksPerHundred: marksPerHundred === null ? null : Math.round(marksPerHundred),
  };
}

export function assessLearner(signals: LearnerSignals): LearnerAssessment {
  const accuracy = ratio(signals.lessons.correct, signals.lessons.answers, MIN_ANSWERS);
  const againRate = ratio(signals.reviews.again, signals.reviews.total, MIN_REVIEWS);
  const marksRatio = ratio(signals.reading.marks, signals.reading.cuesRead, MIN_CUES_READ);
  const marksPerHundred = marksRatio === null ? null : marksRatio * PERCENT;
  const challenge = decideChallenge(accuracy, againRate, marksPerHundred);
  const shift = challenge === "harder" ? CHALLENGE_SHIFT : challenge === "easier" ? -CHALLENGE_SHIFT : 0;
  return {
    challenge,
    targetIndex: levelIndex(signals.level) + shift,
    accuracy,
    againRate,
    marksPerHundred,
    insight: describe(challenge, accuracy, againRate, marksPerHundred),
  };
}

const LEVEL_BY_GENRE: readonly { pattern: RegExp; range: readonly [CefrLevel, CefrLevel] }[] = [
  { pattern: /fam[ií]lia|kids|infantil|anima/i, range: ["A2", "B1"] },
  { pattern: /com[eé]dia|romance|reality/i, range: ["B1", "B2"] },
  { pattern: /crime|guerra|hist[oó]ria|pol[ií]tica|fic[cç][aã]o|mist[eé]rio|document/i, range: ["B2", "C1"] },
];
const DEFAULT_RANGE: readonly [CefrLevel, CefrLevel] = ["B1", "B2"];

export function estimateLevelRange(genres: readonly string[]): readonly [CefrLevel, CefrLevel] {
  const ranges = genres.flatMap(
    (genre) => LEVEL_BY_GENRE.find((rule) => rule.pattern.test(genre))?.range ?? [],
  );
  if (ranges.length === 0) return DEFAULT_RANGE;
  const indexes = ranges.map(levelIndex);
  const lowest = CEFR_LEVELS[Math.min(...indexes)] ?? DEFAULT_RANGE[0];
  const highest = CEFR_LEVELS[Math.max(...indexes)] ?? DEFAULT_RANGE[1];
  return [lowest, highest];
}

export function levelFitScore(targetIndex: number, min: CefrLevel, max: CefrLevel): number {
  const low = levelIndex(min);
  const high = levelIndex(max);
  const distance = targetIndex < low ? low - targetIndex : targetIndex > high ? targetIndex - high : 0;
  return Math.max(0, 1 - distance * FIT_LOSS_PER_LEVEL);
}

export function fitLabel(targetIndex: number, min: CefrLevel, max: CefrLevel): LevelFit {
  if (Math.ceil(targetIndex) < levelIndex(min)) return "challenging";
  if (Math.floor(targetIndex) > levelIndex(max)) return "easy";
  return "fit";
}

const ENGAGEMENT_STEP = 0.25;
const ACCURACY_STEP = 0.05;
const RATE_STEP = 0.1;
const MARKS_STEP = 2;

const bucket = (value: number | null, step: number): number | null =>
  value === null ? null : Math.round(value / step);

export function signalsFingerprint(signals: LearnerSignals, feedbackCount: number): string {
  const assessment = assessLearner(signals);
  return JSON.stringify([
    signals.level,
    signals.language,
    signals.works
      .map((work) => `${work.workKey}:${bucket(work.engagement, ENGAGEMENT_STEP)}`)
      .sort((left, right) => left.localeCompare(right)),
    bucket(assessment.accuracy, ACCURACY_STEP),
    bucket(assessment.againRate, RATE_STEP),
    bucket(assessment.marksPerHundred, MARKS_STEP),
    feedbackCount,
  ]);
}
