import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import { startOfLocalDay } from "@/shared/time";
import { EMPTY_SNAPSHOT, type ProfileSnapshot } from "../domain/profile";
import type { SnapshotRepository, XpRepository } from "./ports";

const MAX_XP_PER_EVENT = 500;
const TODAY_INDEX = 6;

export type ProfileSummary = ProfileSnapshot & { dailyGoal: number; goalMet: boolean };

export function makeAwardXp(deps: { xp: XpRepository; clock: Clock; ids: IdGenerator }) {
  return async function awardXp(input: {
    userId: string;
    source: string;
    sourceId: string;
    amount: number;
  }): Promise<void> {
    if (!Number.isInteger(input.amount) || input.amount <= 0 || input.amount > MAX_XP_PER_EVENT) return;
    await deps.xp.award({ id: deps.ids.next(), ...input, createdAt: deps.clock.now() });
  };
}

export function makeGetProfileSummary(deps: {
  xp: XpRepository;
  snapshots: SnapshotRepository;
  clock: Clock;
}) {
  return async function getProfileSummary(input: {
    userId: string;
    dailyGoal: number;
    timezone: string;
  }): Promise<ProfileSummary> {
    const now = deps.clock.now();
    const [stored, earnedToday, earnedTotal] = await Promise.all([
      deps.snapshots.get(input.userId),
      deps.xp.sumSince(input.userId, startOfLocalDay(now, input.timezone)),
      deps.xp.total(input.userId),
    ]);
    const snapshot = stored ?? EMPTY_SNAPSHOT;
    const xpToday = snapshot.xpToday + earnedToday;
    const weekly = snapshot.weekly.map((value, index) => (index === TODAY_INDEX ? xpToday : value));
    return {
      ...snapshot,
      xpToday,
      totalXp: snapshot.totalXp + earnedTotal,
      weekly,
      dailyGoal: input.dailyGoal,
      goalMet: xpToday >= input.dailyGoal,
    };
  };
}

export function makeSaveSnapshot(deps: { snapshots: SnapshotRepository; clock: Clock }) {
  return async function saveSnapshot(userId: string, snapshot: ProfileSnapshot): Promise<void> {
    await deps.snapshots.upsert(userId, snapshot, deps.clock.now());
  };
}

export function makeGetTagline(deps: { snapshots: SnapshotRepository }) {
  return async function getTagline(userId: string): Promise<{ tagline: string; streak: number }> {
    const snapshot = (await deps.snapshots.get(userId)) ?? EMPTY_SNAPSHOT;
    return { tagline: snapshot.tagline, streak: snapshot.streak };
  };
}
