import { describe, expect, it } from "vitest";
import { computeActivity, dailyMissions, earnedAchievements, heatLevel } from "./activity";

const TZ = "America/Sao_Paulo";
const now = new Date("2026-10-10T15:00:00Z");
const day = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10);

describe("atividade calculada dos eventos de XP", () => {
  it("conta a sequência a partir de ontem enquanto a meta de hoje não foi batida", () => {
    const activity = computeActivity({
      now,
      timeZone: TZ,
      dailyGoal: 50,
      days: [
        { day: day(0), xp: 30 },
        { day: day(1), xp: 60 },
        { day: day(2), xp: 50 },
        { day: day(3), xp: 80 },
        { day: day(4), xp: 10 },
        { day: day(5), xp: 90 },
      ],
    });
    expect(activity).toMatchObject({
      xpToday: 30,
      goalMet: false,
      streak: 3,
      longestStreak: 3,
      totalXp: 320,
    });
    expect(activity.weekly).toEqual([0, 90, 10, 80, 50, 60, 30]);
    expect(activity.heat.slice(-6)).toEqual([3, 1, 3, 2, 2, 1]);
    expect(activity.heat).toHaveLength(35);
  });

  it("inclui hoje quando a meta já foi batida e zera quando ontem falhou", () => {
    const met = computeActivity({
      now,
      timeZone: TZ,
      dailyGoal: 50,
      days: [
        { day: day(0), xp: 50 },
        { day: day(1), xp: 50 },
      ],
    });
    expect(met).toMatchObject({ streak: 2, goalMet: true });
    const broken = computeActivity({
      now,
      timeZone: TZ,
      dailyGoal: 50,
      days: [
        { day: day(0), xp: 10 },
        { day: day(2), xp: 500 },
      ],
    });
    expect(broken).toMatchObject({ streak: 0, longestStreak: 1 });
  });

  it("guarda o recorde mesmo depois de a sequência quebrar", () => {
    const days = [9, 8, 7, 6, 5]
      .map((ago) => ({ day: day(ago), xp: 100 }))
      .concat([{ day: day(1), xp: 100 }]);
    expect(computeActivity({ now, timeZone: TZ, dailyGoal: 100, days })).toMatchObject({
      streak: 1,
      longestStreak: 5,
    });
  });

  it("usa o fuso da conta: estudar à noite conta para o dia local", () => {
    const lateNight = new Date("2026-10-11T01:30:00Z");
    const activity = computeActivity({
      now: lateNight,
      timeZone: TZ,
      dailyGoal: 50,
      days: [{ day: "2026-10-10", xp: 70 }],
    });
    expect(activity).toMatchObject({ xpToday: 70, goalMet: true, streak: 1 });
    expect(
      computeActivity({
        now: lateNight,
        timeZone: "UTC",
        dailyGoal: 50,
        days: [{ day: "2026-10-10", xp: 70 }],
      }).xpToday,
    ).toBe(0);
  });

  it("classifica o dia no mapa de estudo", () => {
    expect([0, 20, 50, 74, 75].map((xp) => heatLevel(xp, 50))).toEqual([0, 1, 2, 2, 3]);
  });

  it("monta as missões do dia e as conquistas ganhas", () => {
    expect(
      dailyMissions({ reviewsToday: 14, lessonsToday: 0 }).map((mission) => [
        mission.kind,
        mission.value,
        mission.max,
      ]),
    ).toEqual([
      ["reviews", 10, 10],
      ["lesson", 0, 1],
      ["tutor", 0, 5],
    ]);
    expect(earnedAchievements({ longestStreak: 8, lessonsEver: 2, base: ["ep10"] }).sort()).toEqual([
      "ep10",
      "first",
      "streak3",
      "streak7",
    ]);
    expect(earnedAchievements({ longestStreak: 0, lessonsEver: 0, base: [] })).toEqual([]);
  });
});
