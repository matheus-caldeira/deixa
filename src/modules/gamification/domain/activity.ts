import { MS_PER_DAY, localDateKey } from "@/shared/time";

export type DailyXp = { day: string; xp: number };

export type Activity = {
  xpToday: number;
  totalXp: number;
  goalMet: boolean;
  streak: number;
  longestStreak: number;
  weekly: number[];
  heat: number[];
};

export const WEEK_DAYS = 7;
export const HEAT_DAYS = 35;
const BONUS_FACTOR = 1.5;
const MAX_STREAK_SCAN_DAYS = 3660;

function dayKeysBack(now: Date, timeZone: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    localDateKey(new Date(now.getTime() - (count - 1 - index) * MS_PER_DAY), timeZone),
  );
}

export function heatLevel(xp: number, dailyGoal: number): number {
  if (xp <= 0) return 0;
  if (dailyGoal <= 0 || xp < dailyGoal) return 1;
  return xp >= dailyGoal * BONUS_FACTOR ? 3 : 2;
}

export function computeActivity(input: {
  days: readonly DailyXp[];
  now: Date;
  timeZone: string;
  dailyGoal: number;
}): Activity {
  const xpByDay = new Map(input.days.map((entry) => [entry.day, entry.xp]));
  const goal = Math.max(1, input.dailyGoal);
  const met = (day: string): boolean => (xpByDay.get(day) ?? 0) >= goal;
  const keyAt = (daysAgo: number): string =>
    localDateKey(new Date(input.now.getTime() - daysAgo * MS_PER_DAY), input.timeZone);

  const today = keyAt(0);
  let streak = 0;
  for (
    let daysAgo = met(today) ? 0 : 1;
    daysAgo < MAX_STREAK_SCAN_DAYS && met(keyAt(daysAgo));
    daysAgo += 1
  ) {
    streak += 1;
  }

  let longestStreak = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of [...xpByDay.keys()].sort()) {
    if (!met(day)) {
      run = 0;
      previous = day;
      continue;
    }
    const consecutive =
      previous !== null &&
      met(previous) &&
      Date.parse(`${day}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`) === MS_PER_DAY;
    run = consecutive ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = day;
  }

  return {
    xpToday: xpByDay.get(today) ?? 0,
    totalXp: input.days.reduce((total, entry) => total + entry.xp, 0),
    goalMet: met(today),
    streak,
    longestStreak: Math.max(longestStreak, streak),
    weekly: dayKeysBack(input.now, input.timeZone, WEEK_DAYS).map((day) => xpByDay.get(day) ?? 0),
    heat: dayKeysBack(input.now, input.timeZone, HEAT_DAYS).map((day) =>
      heatLevel(xpByDay.get(day) ?? 0, goal),
    ),
  };
}

export type MissionKind = "reviews" | "lesson" | "tutor";
export type Mission = {
  kind: MissionKind;
  icon: "cards" | "ear" | "chat";
  title: string;
  value: number;
  max: number;
};

export const MISSION_XP = 20;
const REVIEW_TARGET = 10;
const LESSON_TARGET = 1;
const TUTOR_TARGET_MINUTES = 5;

export function dailyMissions(counts: { reviewsToday: number; lessonsToday: number }): Mission[] {
  return [
    {
      kind: "reviews",
      icon: "cards",
      title: `Revise ${REVIEW_TARGET} cartões`,
      value: Math.min(REVIEW_TARGET, counts.reviewsToday),
      max: REVIEW_TARGET,
    },
    {
      kind: "lesson",
      icon: "ear",
      title: "Complete 1 lição da trilha",
      value: Math.min(LESSON_TARGET, counts.lessonsToday),
      max: LESSON_TARGET,
    },
    { kind: "tutor", icon: "chat", title: "Converse 5 min com o tutor", value: 0, max: TUTOR_TARGET_MINUTES },
  ];
}

const STREAK_ACHIEVEMENTS: readonly [string, number][] = [
  ["streak3", 3],
  ["streak7", 7],
  ["streak30", 30],
];

export function earnedAchievements(input: {
  longestStreak: number;
  lessonsEver: number;
  base: readonly string[];
}): string[] {
  const earned = new Set(input.base);
  if (input.lessonsEver > 0) earned.add("first");
  for (const [id, days] of STREAK_ACHIEVEMENTS) if (input.longestStreak >= days) earned.add(id);
  return [...earned];
}
