import { z } from "zod";
import { MS_PER_DAY, localDateKey, startOfLocalDay } from "@/shared/time";
import type { AiUsageEvent } from "./usage";

const MAX_USD = 100_000;
const MAX_TOKENS = 1_000_000_000_000;
const WEEK_DAYS = 7;
const WARNING_RATIO = 0.8;
const NOON_UTC_HOUR = 12;

export const usageLimitSchema = z.object({
  usdPerDay: z.number().min(0).max(MAX_USD).nullable(),
  usdPerMonth: z.number().min(0).max(MAX_USD).nullable(),
  tokensPerDay: z.number().int().min(0).max(MAX_TOKENS).nullable(),
  tokensPerMonth: z.number().int().min(0).max(MAX_TOKENS).nullable(),
});
export type UsageLimit = z.infer<typeof usageLimitSchema>;

export const NO_LIMIT: UsageLimit = {
  usdPerDay: null,
  usdPerMonth: null,
  tokensPerDay: null,
  tokensPerMonth: null,
};

export const SHARED_KEY_DEFAULT_LIMIT: UsageLimit = {
  usdPerDay: 0.5,
  usdPerMonth: 5,
  tokensPerDay: 2_000_000,
  tokensPerMonth: 20_000_000,
};

export type PeriodTotals = { usd: number; tokens: number; unknownCostCalls: number; calls: number };

export const EMPTY_TOTALS: PeriodTotals = { usd: 0, tokens: 0, unknownCostCalls: 0, calls: 0 };

export function sumEvents(events: AiUsageEvent[]): PeriodTotals {
  return events.reduce(
    (acc, event) => ({
      usd: acc.usd + (event.estimatedCostUsd ?? 0),
      tokens: acc.tokens + event.inputTokens + event.outputTokens,
      unknownCostCalls: acc.unknownCostCalls + (event.estimatedCostUsd === null ? 1 : 0),
      calls: acc.calls + 1,
    }),
    EMPTY_TOTALS,
  );
}

export type Periods = { dayStart: Date; monthStart: Date; weekStart: Date };

export function periodsFor(now: Date, timeZone: string): Periods {
  const dayStart = startOfLocalDay(now, timeZone);
  const [year, month] = localDateKey(now, timeZone).split("-").map(Number);
  const firstDayNoon = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1, NOON_UTC_HOUR));
  const monthStart = startOfLocalDay(firstDayNoon, timeZone);
  const weekStart = new Date(dayStart.getTime() - (WEEK_DAYS - 1) * MS_PER_DAY);
  return { dayStart, monthStart, weekStart };
}

export function weeklyUsd(events: AiUsageEvent[], now: Date, timeZone: string): number[] {
  const keys = Array.from({ length: WEEK_DAYS }, (_, index) =>
    localDateKey(new Date(now.getTime() - (WEEK_DAYS - 1 - index) * MS_PER_DAY), timeZone),
  );
  const byDay = new Map<string, number>();
  for (const event of events) {
    const key = localDateKey(event.createdAt, timeZone);
    byDay.set(key, (byDay.get(key) ?? 0) + (event.estimatedCostUsd ?? 0));
  }
  return keys.map((key) => byDay.get(key) ?? 0);
}

export type LimitPeriod = "day" | "month";
export type LimitState = { blocked: LimitPeriod | null; warning: LimitPeriod | null };

function exceeded(limit: number | null, spent: number): boolean {
  return limit !== null && limit > 0 && spent >= limit;
}

function nearing(limit: number | null, spent: number): boolean {
  return limit !== null && limit > 0 && spent >= limit * WARNING_RATIO;
}

export function checkLimit(limit: UsageLimit, today: PeriodTotals, month: PeriodTotals): LimitState {
  const dayBlocked = exceeded(limit.usdPerDay, today.usd) || exceeded(limit.tokensPerDay, today.tokens);
  const monthBlocked = exceeded(limit.usdPerMonth, month.usd) || exceeded(limit.tokensPerMonth, month.tokens);
  const blocked: LimitPeriod | null = monthBlocked ? "month" : dayBlocked ? "day" : null;
  if (blocked) return { blocked, warning: null };
  const dayWarning = nearing(limit.usdPerDay, today.usd) || nearing(limit.tokensPerDay, today.tokens);
  const monthWarning = nearing(limit.usdPerMonth, month.usd) || nearing(limit.tokensPerMonth, month.tokens);
  return { blocked: null, warning: monthWarning ? "month" : dayWarning ? "day" : null };
}

export function hasAnyLimit(limit: UsageLimit): boolean {
  return Object.values(limit).some((value) => value !== null && value > 0);
}
