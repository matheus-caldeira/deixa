import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import { MS_PER_DAY, localDateKey, startOfLocalDay } from "@/shared/time";
import {
  MISSION_XP,
  computeActivity,
  dailyMissions,
  earnedAchievements,
  type Activity,
  type Mission,
} from "../domain/activity";
import { levelProgressPercent, overallAccuracy, skillPercents, type Skill } from "../domain/profile";
import type { ActivityCounts, XpRepository } from "./ports";

const MAX_XP_PER_EVENT = 100_000;
const WINDOW_DAYS = 30;
const RECURRING_LIMIT = 5;
const DICTATION_KIND = "type";

export type ProfileSummary = Activity & {
  dailyGoal: number;
  missions: Mission[];
  achievements: string[];
  learned: number;
  levelPct: number;
  accuracy: number;
  skills: { key: Skill; percent: number }[];
  recurringErrors: { term: string; count: number }[];
};

type Deps = {
  xp: XpRepository;
  counts: ActivityCounts;
  clock: Clock;
  ids: IdGenerator;
};

export function makeAwardXp(deps: Pick<Deps, "xp" | "clock" | "ids">) {
  return async function awardXp(input: {
    userId: string;
    source: string;
    sourceId: string;
    amount: number;
    at?: Date;
  }): Promise<void> {
    if (!Number.isInteger(input.amount) || input.amount <= 0 || input.amount > MAX_XP_PER_EVENT) return;
    await deps.xp.award({
      id: deps.ids.next(),
      userId: input.userId,
      source: input.source,
      sourceId: input.sourceId,
      amount: input.amount,
      createdAt: input.at ?? deps.clock.now(),
    });
  };
}

export function makeGetProfileSummary(deps: Pick<Deps, "xp" | "counts" | "clock">) {
  return async function getProfileSummary(input: {
    userId: string;
    dailyGoal: number;
    timezone: string;
  }): Promise<ProfileSummary> {
    const now = deps.clock.now();
    const dayStart = startOfLocalDay(now, input.timezone);
    const windowStart = new Date(now.getTime() - WINDOW_DAYS * MS_PER_DAY);
    const [
      days,
      reviewsToday,
      lessonsToday,
      lessonsEver,
      cardsOwned,
      recentLessons,
      allLessons,
      reviews,
      recurringErrors,
      episodesCompleted,
      conversationScores,
      phrasalCards,
    ] = await Promise.all([
      deps.xp.dailyTotals(input.userId, input.timezone),
      deps.counts.reviewsSince(input.userId, dayStart),
      deps.counts.lessonsSince(input.userId, dayStart),
      deps.counts.lessonsEver(input.userId),
      deps.counts.cardsOwned(input.userId),
      deps.counts.lessonStats(input.userId, windowStart),
      deps.counts.lessonStats(input.userId, null),
      deps.counts.reviewOutcomesSince(input.userId, windowStart),
      deps.counts.recurringMisses(input.userId, windowStart, RECURRING_LIMIT),
      deps.counts.episodesCompleted(input.userId),
      deps.counts.conversationScores(input.userId),
      deps.counts.phrasalCards(input.userId),
    ]);
    const activity = computeActivity({ days, now, timeZone: input.timezone, dailyGoal: input.dailyGoal });
    const dictation = allLessons.byKind[DICTATION_KIND];
    return {
      ...activity,
      dailyGoal: input.dailyGoal,
      learned: cardsOwned,
      levelPct: levelProgressPercent({ lessonsPassed: allLessons.passed, cardsOwned }),
      accuracy: overallAccuracy({ lessons: recentLessons, reviews }),
      skills: skillPercents({ lessons: recentLessons, reviews, conversationScores }),
      recurringErrors,
      missions: dailyMissions({ reviewsToday, lessonsToday }),
      achievements: earnedAchievements({
        longestStreak: activity.longestStreak,
        lessonsEver,
        phrasalCards,
        episodesCompleted,
        conversationsReviewed: conversationScores.length,
        perfectDictations: dictation && dictation.total > 0 && dictation.correct === dictation.total ? 1 : 0,
      }),
    };
  };
}

export function makeSettleMissions(deps: Pick<Deps, "xp" | "counts" | "clock" | "ids">) {
  const awardXp = makeAwardXp(deps);
  return async function settleMissions(userId: string, timezone: string): Promise<void> {
    const now = deps.clock.now();
    const dayStart = startOfLocalDay(now, timezone);
    const [reviewsToday, lessonsToday] = await Promise.all([
      deps.counts.reviewsSince(userId, dayStart),
      deps.counts.lessonsSince(userId, dayStart),
    ]);
    const today = localDateKey(now, timezone);
    for (const mission of dailyMissions({ reviewsToday, lessonsToday })) {
      if (mission.value < mission.max) continue;
      await awardXp({ userId, source: "mission", sourceId: `${mission.kind}:${today}`, amount: MISSION_XP });
    }
  };
}
