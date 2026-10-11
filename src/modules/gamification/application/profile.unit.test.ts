import { describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { SequentialIds } from "@/shared/ids";
import { localDateKey } from "@/shared/time";
import { EMPTY_SNAPSHOT, type ProfileSnapshot } from "../domain/profile";
import type { ActivityCounts, SnapshotRepository, XpRepository } from "./ports";
import {
  makeAwardXp,
  makeGetProfileSummary,
  makeSaveSnapshot,
  makeSettleMissions,
} from "./profile-use-cases";

type Event = { userId: string; source: string; sourceId: string; amount: number; createdAt: Date };

function setup() {
  const events: Event[] = [];
  const snapshots = new Map<string, ProfileSnapshot>();
  const activity = { reviews: 0, lessons: 0, lessonsEver: 0, cards: 0 };
  const xp: XpRepository = {
    award: async (event) => {
      const duplicate = events.some(
        (known) =>
          known.userId === event.userId && known.source === event.source && known.sourceId === event.sourceId,
      );
      if (!duplicate) events.push(event);
      return !duplicate;
    },
    dailyTotals: async (userId, timeZone) => {
      const totals = new Map<string, number>();
      for (const event of events.filter((candidate) => candidate.userId === userId)) {
        const day = localDateKey(event.createdAt, timeZone);
        totals.set(day, (totals.get(day) ?? 0) + event.amount);
      }
      return [...totals].map(([day, amount]) => ({ day, xp: amount }));
    },
  };
  const snapshotRepository: SnapshotRepository = {
    get: async (userId) => snapshots.get(userId) ?? null,
    upsert: async (userId, snapshot) => {
      snapshots.set(userId, snapshot);
    },
  };
  const counts: ActivityCounts = {
    reviewsSince: async () => activity.reviews,
    lessonsSince: async () => activity.lessons,
    lessonsEver: async () => activity.lessonsEver,
    cardsOwned: async () => activity.cards,
  };
  const clock = new FixedClock("2026-10-10T15:00:00Z");
  const deps = { xp, snapshots: snapshotRepository, counts, clock, ids: new SequentialIds("xp") };
  return {
    events,
    clock,
    activity,
    award: makeAwardXp(deps),
    summary: makeGetProfileSummary(deps),
    save: makeSaveSnapshot(deps),
    settle: makeSettleMissions(deps),
  };
}

const prefs = { dailyGoal: 50, timezone: "America/Sao_Paulo" };

describe("perfil calculado dos eventos", () => {
  it("calcula XP de hoje, total e sequência por usuário, sem misturar contas", async () => {
    const app = setup();
    await app.save("ana", { ...EMPTY_SNAPSHOT, tagline: "Começando", learnedBase: 30 });
    app.activity.cards = 8;
    await app.award({
      userId: "ana",
      source: "lesson",
      sourceId: "ontem",
      amount: 60,
      at: new Date("2026-10-09T15:00:00Z"),
    });
    await app.award({ userId: "ana", source: "highlight_cards", sourceId: "b1", amount: 10 });
    await app.award({ userId: "lucas", source: "review", sourceId: "r1", amount: 2 });

    const ana = await app.summary({ userId: "ana", ...prefs });
    expect(ana).toMatchObject({
      xpToday: 10,
      totalXp: 70,
      streak: 1,
      goalMet: false,
      learned: 38,
      tagline: "Começando",
    });
    expect(ana.weekly.slice(-2)).toEqual([60, 10]);
    const lucas = await app.summary({ userId: "lucas", ...prefs });
    expect(lucas).toMatchObject({ xpToday: 2, totalXp: 2, streak: 0 });
  });

  it("não paga duas vezes pelo mesmo evento e ignora valores inválidos", async () => {
    const app = setup();
    await app.award({ userId: "ana", source: "highlight_cards", sourceId: "b1", amount: 10 });
    await app.award({ userId: "ana", source: "highlight_cards", sourceId: "b1", amount: 10 });
    await app.award({ userId: "ana", source: "review", sourceId: "r1", amount: -5 });
    await app.award({ userId: "ana", source: "review", sourceId: "r2", amount: 1.5 });
    expect(app.events).toHaveLength(1);
  });

  it("paga cada missão do dia uma única vez e de novo no dia seguinte", async () => {
    const app = setup();
    app.activity.reviews = 10;
    app.activity.lessons = 1;
    app.activity.lessonsEver = 1;
    await app.settle("ana", prefs.timezone);
    await app.settle("ana", prefs.timezone);
    expect(app.events.map((event) => [event.source, event.sourceId, event.amount])).toEqual([
      ["mission", "reviews:2026-10-10", 20],
      ["mission", "lesson:2026-10-10", 20],
    ]);
    const summary = await app.summary({ userId: "ana", ...prefs });
    expect(summary.missions.map((mission) => mission.value)).toEqual([10, 1, 0]);
    expect(summary.achievements).toContain("first");
    expect(summary.xpToday).toBe(40);

    app.clock.advanceDays(1);
    await app.settle("ana", prefs.timezone);
    expect(app.events).toHaveLength(4);
  });

  it("não paga missão incompleta", async () => {
    const app = setup();
    app.activity.reviews = 9;
    await app.settle("ana", prefs.timezone);
    expect(app.events).toEqual([]);
  });
});
