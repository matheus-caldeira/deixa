import { describe, expect, it } from "vitest";
import { NO_LIMIT, checkLimit, periodsFor, sumEvents, weeklyUsd } from "./limits";
import type { AiUsageEvent } from "./usage";

const event = (createdAt: string, usd: number | null, tokens = 100): AiUsageEvent => ({
  id: createdAt,
  userId: "ana",
  provider: "google",
  model: "m",
  operation: "cards",
  keySource: "user",
  inputTokens: tokens,
  outputTokens: 0,
  estimatedCostUsd: usd,
  createdAt: new Date(createdAt),
});

describe("limites de uso da IA", () => {
  it("soma valor e tokens e conta as chamadas sem preço à parte", () => {
    const totals = sumEvents([event("2026-10-13T10:00:00Z", 0.5), event("2026-10-13T11:00:00Z", null)]);
    expect(totals).toEqual({ usd: 0.5, tokens: 200, unknownCostCalls: 1, calls: 2 });
  });

  it("o dia e o mês seguem o fuso do usuário", () => {
    const periods = periodsFor(new Date("2026-10-01T01:30:00Z"), "America/Sao_Paulo");
    expect(periods.dayStart.toISOString()).toBe("2026-09-30T03:00:00.000Z");
    expect(periods.monthStart.toISOString()).toBe("2026-09-01T03:00:00.000Z");
  });

  it("trava pelo mês antes do dia e avisa a partir de 80%", () => {
    const limit = { ...NO_LIMIT, usdPerDay: 1, usdPerMonth: 10 };
    const spent = (usd: number) => ({ usd, tokens: 0, unknownCostCalls: 0, calls: 1 });
    expect(checkLimit(limit, spent(0.5), spent(5))).toEqual({ blocked: null, warning: null });
    expect(checkLimit(limit, spent(0.8), spent(5))).toEqual({ blocked: null, warning: "day" });
    expect(checkLimit(limit, spent(1), spent(5))).toEqual({ blocked: "day", warning: null });
    expect(checkLimit(limit, spent(1), spent(10))).toEqual({ blocked: "month", warning: null });
    expect(checkLimit(NO_LIMIT, spent(999), spent(999))).toEqual({ blocked: null, warning: null });
  });

  it("limite em tokens vale mesmo sem preço cadastrado", () => {
    const limit = { ...NO_LIMIT, tokensPerDay: 150 };
    const today = sumEvents([event("2026-10-13T10:00:00Z", null), event("2026-10-13T11:00:00Z", null)]);
    expect(checkLimit(limit, today, today).blocked).toBe("day");
  });

  it("a semana traz sete dias terminando hoje", () => {
    const now = new Date("2026-10-13T15:00:00Z");
    const week = weeklyUsd(
      [event("2026-10-13T10:00:00Z", 0.3), event("2026-10-07T10:00:00Z", 0.2)],
      now,
      "UTC",
    );
    expect(week).toEqual([0.2, 0, 0, 0, 0, 0, 0.3]);
  });
});
