import { describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { SequentialIds } from "@/shared/ids";
import { EMPTY_SNAPSHOT, type ProfileSnapshot } from "../domain/profile";
import type { SnapshotRepository, XpRepository } from "./ports";
import { makeAwardXp, makeGetProfileSummary, makeSaveSnapshot } from "./profile-use-cases";

type Event = { userId: string; source: string; sourceId: string; amount: number; createdAt: Date };

function setup() {
  const events: Event[] = [];
  const snapshots = new Map<string, ProfileSnapshot>();
  const xp: XpRepository = {
    award: async (event) => {
      const duplicate = events.some(
        (known) =>
          known.userId === event.userId && known.source === event.source && known.sourceId === event.sourceId,
      );
      if (!duplicate) events.push(event);
      return !duplicate;
    },
    sumSince: async (userId, since) =>
      events.filter((e) => e.userId === userId && e.createdAt >= since).reduce((sum, e) => sum + e.amount, 0),
    total: async (userId) => events.filter((e) => e.userId === userId).reduce((sum, e) => sum + e.amount, 0),
  };
  const snapshotRepository: SnapshotRepository = {
    get: async (userId) => snapshots.get(userId) ?? null,
    upsert: async (userId, snapshot) => {
      snapshots.set(userId, snapshot);
    },
  };
  const clock = new FixedClock("2026-10-10T15:00:00Z");
  const deps = { xp, snapshots: snapshotRepository, clock, ids: new SequentialIds("xp") };
  return {
    events,
    clock,
    award: makeAwardXp(deps),
    summary: makeGetProfileSummary(deps),
    save: makeSaveSnapshot(deps),
  };
}

const prefs = { dailyGoal: 50, timezone: "America/Sao_Paulo" };

describe("XP por eventos e retrato do perfil", () => {
  it("soma os eventos de hoje ao retrato, por usuário", async () => {
    const app = setup();
    await app.save("ana", {
      ...EMPTY_SNAPSHOT,
      xpToday: 30,
      totalXp: 420,
      streak: 3,
      weekly: [0, 25, 40, 0, 35, 50, 30],
    });
    await app.award({ userId: "ana", source: "highlight_cards", sourceId: "b1", amount: 10 });
    await app.award({ userId: "lucas", source: "review", sourceId: "r1", amount: 2 });

    const ana = await app.summary({ userId: "ana", ...prefs });
    expect(ana).toMatchObject({ xpToday: 40, totalXp: 430, streak: 3, goalMet: false, dailyGoal: 50 });
    expect(ana.weekly[6]).toBe(40);
    const lucas = await app.summary({ userId: "lucas", ...prefs });
    expect(lucas).toMatchObject({ xpToday: 2, totalXp: 2, streak: 0 });
  });

  it("não paga duas vezes pelo mesmo evento e ignora valores inválidos", async () => {
    const app = setup();
    await app.award({ userId: "ana", source: "highlight_cards", sourceId: "b1", amount: 10 });
    await app.award({ userId: "ana", source: "highlight_cards", sourceId: "b1", amount: 10 });
    await app.award({ userId: "ana", source: "review", sourceId: "r1", amount: -5 });
    await app.award({ userId: "ana", source: "review", sourceId: "r2", amount: 100_000 });
    expect(app.events).toHaveLength(1);
  });

  it("usa o fuso da conta para decidir o que conta como hoje e marca a meta cumprida", async () => {
    const app = setup();
    await app.award({ userId: "ana", source: "review", sourceId: "ontem", amount: 40 });
    app.clock.advanceDays(1);
    await app.award({ userId: "ana", source: "review", sourceId: "hoje", amount: 50 });
    const summary = await app.summary({ userId: "ana", ...prefs });
    expect(summary).toMatchObject({ xpToday: 50, totalXp: 90, goalMet: true });
  });
});
