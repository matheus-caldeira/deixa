import { MS_PER_DAY } from "@/shared/time";

export const RATINGS = ["again", "hard", "good", "easy"] as const;
export type Rating = (typeof RATINGS)[number];

export const RATING_LABELS: Record<Rating, string> = {
  again: "De novo",
  hard: "Difícil",
  good: "Bom",
  easy: "Fácil",
};

export type CardState = {
  intervalDays: number;
  repetitions: number;
  lapses: number;
  stability: number;
  difficulty: number;
};

export const NEW_CARD_STATE: CardState = {
  intervalDays: 0,
  repetitions: 0,
  lapses: 0,
  stability: 0,
  difficulty: 2.5,
};

export const REVIEW_XP = 2;
const RELEARN_DELAY_MS = 10 * 60 * 1000;
const MIN_EASE = 1.3;
const MAX_EASE = 3;
const FIRST_INTERVAL_DAYS: Record<Exclude<Rating, "again">, number> = { hard: 1, good: 3, easy: 7 };
const HARD_FACTOR = 1.2;
const EASY_BONUS = 1.3;
const EASE_STEP: Record<Rating, number> = { again: -0.2, hard: -0.15, good: 0, easy: 0.15 };
const DAYS_PER_MONTH = 30;

const clampEase = (ease: number): number =>
  Math.min(MAX_EASE, Math.max(MIN_EASE, Math.round(ease * 100) / 100));

export function review(state: CardState, rating: Rating): { state: CardState; dueInMs: number } {
  const difficulty = clampEase(state.difficulty + EASE_STEP[rating]);
  if (rating === "again") {
    return {
      state: { intervalDays: 0, repetitions: 0, lapses: state.lapses + 1, stability: 0, difficulty },
      dueInMs: RELEARN_DELAY_MS,
    };
  }
  const isFirstSuccess = state.repetitions === 0 || state.intervalDays === 0;
  const grown =
    rating === "hard"
      ? state.intervalDays * HARD_FACTOR
      : rating === "good"
        ? state.intervalDays * state.difficulty
        : state.intervalDays * state.difficulty * EASY_BONUS;
  const intervalDays = isFirstSuccess
    ? FIRST_INTERVAL_DAYS[rating]
    : Math.max(state.intervalDays + 1, Math.round(grown));
  return {
    state: {
      intervalDays,
      repetitions: state.repetitions + 1,
      lapses: state.lapses,
      stability: intervalDays,
      difficulty,
    },
    dueInMs: intervalDays * MS_PER_DAY,
  };
}

export function formatInterval(dueInMs: number): string {
  if (dueInMs < MS_PER_DAY) return "<10 min";
  const days = Math.round(dueInMs / MS_PER_DAY);
  if (days < DAYS_PER_MONTH) return days === 1 ? "1 dia" : `${days} dias`;
  const months = Math.round(days / DAYS_PER_MONTH);
  return months === 1 ? "1 mês" : `${months} meses`;
}

export function previewIntervals(state: CardState): Record<Rating, string> {
  return {
    again: formatInterval(review(state, "again").dueInMs),
    hard: formatInterval(review(state, "hard").dueInMs),
    good: formatInterval(review(state, "good").dueInMs),
    easy: formatInterval(review(state, "easy").dueInMs),
  };
}

export function isRating(value: unknown): value is Rating {
  return typeof value === "string" && (RATINGS as readonly string[]).includes(value);
}
