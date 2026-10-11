import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import { localDateKey, startOfLocalDay } from "@/shared/time";
import {
  MISSION_XP,
  computeActivity,
  dailyMissions,
  earnedAchievements,
  type Activity,
  type Mission,
} from "../domain/activity";
import { EMPTY_SNAPSHOT, type ProfileSnapshot } from "../domain/profile";
import type { ActivityCounts, SnapshotRepository, XpRepository } from "./ports";

const MAX_XP_PER_EVENT = 100_000;

export type ProfileSummary = Omit<ProfileSnapshot, "achievements" | "learnedBase"> &
  Activity & { dailyGoal: number; missions: Mission[]; achievements: string[]; learned: number };

type Deps = {
  xp: XpRepository;
  snapshots: SnapshotRepository;
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

export function makeGetProfileSummary(deps: Pick<Deps, "xp" | "snapshots" | "counts" | "clock">) {
  return async function getProfileSummary(input: {
    userId: string;
    dailyGoal: number;
    timezone: string;
  }): Promise<ProfileSummary> {
    const now = deps.clock.now();
    const dayStart = startOfLocalDay(now, input.timezone);
    const [stored, days, reviewsToday, lessonsToday, lessonsEver, cardsOwned] = await Promise.all([
      deps.snapshots.get(input.userId),
      deps.xp.dailyTotals(input.userId, input.timezone),
      deps.counts.reviewsSince(input.userId, dayStart),
      deps.counts.lessonsSince(input.userId, dayStart),
      deps.counts.lessonsEver(input.userId),
      deps.counts.cardsOwned(input.userId),
    ]);
    const { achievements, learnedBase, ...snapshot } = stored ?? EMPTY_SNAPSHOT;
    const activity = computeActivity({ days, now, timeZone: input.timezone, dailyGoal: input.dailyGoal });
    return {
      ...snapshot,
      ...activity,
      dailyGoal: input.dailyGoal,
      learned: learnedBase + cardsOwned,
      missions: dailyMissions({ reviewsToday, lessonsToday }),
      achievements: earnedAchievements({
        longestStreak: activity.longestStreak,
        lessonsEver,
        base: achievements,
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

export function makeSaveSnapshot(deps: Pick<Deps, "snapshots" | "clock">) {
  return async function saveSnapshot(userId: string, snapshot: ProfileSnapshot): Promise<void> {
    await deps.snapshots.upsert(userId, snapshot, deps.clock.now());
  };
}
