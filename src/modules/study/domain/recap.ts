import { MS_PER_DAY } from "@/shared/time";
import { createRandom, shuffled, type Exercise } from "./exercises";

export const RECAP_INTERVAL_DAYS = [1, 7, 30] as const;
export const RECAP_STEPS = RECAP_INTERVAL_DAYS.length;
export const RECAP_EXERCISES = 6;
export const RECAP_SOURCES = ["catalog", "personal"] as const;
export type RecapSource = (typeof RECAP_SOURCES)[number];

export type Recap = {
  id: string;
  userId: string;
  source: RecapSource;
  episodeId: string;
  step: number;
  dueAt: Date | null;
  updatedAt: Date;
};

export function firstRecapDue(completedAt: Date): Date {
  return new Date(completedAt.getTime() + (RECAP_INTERVAL_DAYS[0] ?? 1) * MS_PER_DAY);
}

export function advanceRecap(step: number, now: Date): { step: number; dueAt: Date | null } {
  const next = step + 1;
  const days = RECAP_INTERVAL_DAYS[next];
  return { step: next, dueAt: days === undefined ? null : new Date(now.getTime() + days * MS_PER_DAY) };
}

export function isRecapDue(recap: Pick<Recap, "dueAt">, now: Date): boolean {
  return recap.dueAt !== null && recap.dueAt <= now;
}

export function pickRecapExercises(input: {
  exercises: readonly Exercise[];
  focusCueIds: ReadonlySet<string>;
  seed: string;
  count?: number;
}): Exercise[] {
  const count = input.count ?? RECAP_EXERCISES;
  const random = createRandom(`recap:${input.seed}`);
  const practice = input.exercises.filter((exercise) => exercise.kind !== "intro");
  const focused = shuffled(
    practice.filter((exercise) => input.focusCueIds.has(exercise.cueId)),
    random,
  );
  const others = shuffled(
    practice.filter((exercise) => !input.focusCueIds.has(exercise.cueId)),
    random,
  );
  return [...focused, ...others].slice(0, count);
}
