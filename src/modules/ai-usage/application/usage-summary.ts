import { AppError } from "@/shared/errors";
import {
  checkLimit,
  periodsFor,
  sumEvents,
  weeklyUsd,
  type LimitState,
  type PeriodTotals,
  type UsageLimit,
} from "../domain/limits";
import {
  AI_OPERATIONS,
  DEFAULT_MODEL_PRICES,
  DEFAULT_PRICES_DATE,
  modelPriceSchema,
  type AiOperation,
  type KeySource,
  type ModelPrice,
} from "../domain/usage";
import type { ModelPriceRepository, StoredModelPrice, UsagePerson } from "./ports";
import { personLimitsOf, resolveLimit, type LimitDeps, type PersonLimits } from "./usage-limits";

export type UsageSummary = {
  keySource: KeySource | null;
  today: PeriodTotals;
  month: PeriodTotals;
  week: number[];
  byOperation: { operation: AiOperation; usd: number; tokens: number }[];
  byModel: { provider: string; model: string; keySource: KeySource; usd: number; tokens: number }[];
  limit: UsageLimit;
  limits: PersonLimits;
  state: LimitState;
  pricesUpdatedAt: Date;
};

export type SummaryDeps = LimitDeps & {
  prices: ModelPriceRepository;
  keySourceOf: (userId: string) => Promise<KeySource | null>;
};

async function pricesUpdatedAt(prices: ModelPriceRepository): Promise<Date> {
  const stored = await prices.list();
  return stored.reduce(
    (latest, price) => (price.updatedAt > latest ? price.updatedAt : latest),
    DEFAULT_PRICES_DATE,
  );
}

export function makeGetAiUsageSummary(deps: SummaryDeps) {
  return async function getAiUsageSummary(userId: string): Promise<UsageSummary> {
    const person = await deps.personOf(userId);
    if (!person) throw new AppError("FORBIDDEN");
    const keySource = await deps.keySourceOf(userId);
    const now = deps.clock.now();
    const periods = periodsFor(now, person.timezone);
    const since = periods.weekStart < periods.monthStart ? periods.weekStart : periods.monthStart;
    const events = await deps.usage.listEvents(userId, since);
    const monthEvents = events.filter((event) => event.createdAt >= periods.monthStart);
    const today = sumEvents(events.filter((event) => event.createdAt >= periods.dayStart));
    const month = sumEvents(monthEvents);
    const limit = await resolveLimit(deps, userId, keySource ?? "user");
    const byOperation = AI_OPERATIONS.map((operation) => {
      const totals = sumEvents(monthEvents.filter((event) => event.operation === operation));
      return { operation, usd: totals.usd, tokens: totals.tokens };
    }).filter((entry) => entry.tokens > 0 || entry.usd > 0);
    const models = new Map<string, UsageSummary["byModel"][number]>();
    for (const event of monthEvents) {
      const key = `${event.provider}/${event.model}/${event.keySource}`;
      const entry = models.get(key) ?? {
        provider: event.provider,
        model: event.model,
        keySource: event.keySource,
        usd: 0,
        tokens: 0,
      };
      entry.usd += event.estimatedCostUsd ?? 0;
      entry.tokens += event.inputTokens + event.outputTokens;
      models.set(key, entry);
    }
    return {
      keySource,
      today,
      month,
      week: weeklyUsd(events, now, person.timezone),
      byOperation,
      byModel: [...models.values()].sort((a, b) => b.usd - a.usd || b.tokens - a.tokens),
      limit,
      limits: await personLimitsOf(deps, userId),
      state: checkLimit(limit, today, month),
      pricesUpdatedAt: await pricesUpdatedAt(deps.prices),
    };
  };
}

export type PersonUsage = {
  person: UsagePerson;
  keySource: KeySource | null;
  monthUsd: number;
  monthTokens: number;
  limit: UsageLimit;
  limits: PersonLimits;
  blocked: boolean;
};

export type UsageOverview = {
  totalMonthUsd: number;
  people: PersonUsage[];
  sharedDefault: UsageLimit;
  prices: (StoredModelPrice & { source: "default" | "stored" })[];
};

export type OverviewDeps = SummaryDeps & { listPeople: () => Promise<UsagePerson[]> };

export function makeGetAiUsageOverview(deps: OverviewDeps) {
  return async function getAiUsageOverview(actor: {
    userId: string;
    isAdmin: boolean;
  }): Promise<UsageOverview> {
    if (!actor.isAdmin) throw new AppError("FORBIDDEN", "adminOnlyUsage");
    const people = await deps.listPeople();
    const now = deps.clock.now();
    const entries: PersonUsage[] = [];
    for (const person of people) {
      const keySource = await deps.keySourceOf(person.id);
      const periods = periodsFor(now, person.timezone);
      const events = await deps.usage.listEvents(person.id, periods.monthStart);
      const month = sumEvents(events);
      const today = sumEvents(events.filter((event) => event.createdAt >= periods.dayStart));
      const limit = keySource ? await resolveLimit(deps, person.id, keySource) : await deps.sharedDefault();
      entries.push({
        person,
        keySource,
        monthUsd: month.usd,
        monthTokens: month.tokens,
        limit,
        limits: await personLimitsOf(deps, person.id),
        blocked: keySource !== null && checkLimit(limit, today, month).blocked !== null,
      });
    }
    const stored = await deps.prices.list();
    const storedKeys = new Set(stored.map((price) => `${price.provider}/${price.model}`));
    const prices = [
      ...stored.map((price) => ({ ...price, source: "stored" as const })),
      ...DEFAULT_MODEL_PRICES.filter((price) => !storedKeys.has(`${price.provider}/${price.model}`)).map(
        (price) => ({ ...price, updatedAt: DEFAULT_PRICES_DATE, source: "default" as const }),
      ),
    ].sort((a, b) => a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model));
    return {
      totalMonthUsd: entries.reduce((sum, entry) => sum + entry.monthUsd, 0),
      people: entries,
      sharedDefault: await deps.sharedDefault(),
      prices,
    };
  };
}

export function makeSaveModelPrice(deps: Pick<SummaryDeps, "prices" | "clock">) {
  return async function saveModelPrice(input: {
    actor: { userId: string; isAdmin: boolean };
    price: unknown;
  }): Promise<ModelPrice> {
    if (!input.actor.isAdmin) throw new AppError("FORBIDDEN", "adminOnlyPrices");
    const parsed = modelPriceSchema.safeParse(input.price);
    if (!parsed.success) throw new AppError("INVALID_INPUT", "pricesInvalid");
    await deps.prices.save(parsed.data, input.actor.userId, deps.clock.now());
    return parsed.data;
  };
}
