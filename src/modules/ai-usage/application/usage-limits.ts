import type { Clock } from "@/shared/clock";
import { AppError } from "@/shared/errors";
import {
  NO_LIMIT,
  checkLimit,
  periodsFor,
  sumEvents,
  tighterLimit,
  usageLimitSchema,
  type LimitPeriod,
  type LimitSlot,
  type UsageLimit,
} from "../domain/limits";
import type { KeySource } from "../domain/usage";
import type { AiUsageRepository, UsageLimitRepository, UsagePerson } from "./ports";

export type LimitDeps = {
  usage: AiUsageRepository;
  limits: UsageLimitRepository;
  sharedDefault: () => Promise<UsageLimit>;
  personOf: (userId: string) => Promise<UsagePerson | null>;
  clock: Clock;
};

const BLOCKED_DETAIL: Record<LimitPeriod, string> = { day: "limitDay", month: "limitMonth" };

export async function resolveLimit(
  deps: LimitDeps,
  userId: string,
  keySource: KeySource,
): Promise<UsageLimit> {
  if (keySource === "user") return (await deps.limits.find(userId, "user")) ?? NO_LIMIT;
  const [shared, cap] = await Promise.all([
    sharedLimitOf(deps, userId),
    deps.limits.find(userId, "global_cap"),
  ]);
  return tighterLimit(shared, cap ?? NO_LIMIT);
}

export async function sharedLimitOf(
  deps: Pick<LimitDeps, "limits" | "sharedDefault">,
  userId: string,
): Promise<UsageLimit> {
  return (await deps.limits.find(userId, "global")) ?? deps.sharedDefault();
}

export type PersonLimits = { own: UsageLimit; shared: UsageLimit; sharedCap: UsageLimit };

export async function personLimitsOf(
  deps: Pick<LimitDeps, "limits" | "sharedDefault">,
  userId: string,
): Promise<PersonLimits> {
  const [own, shared, sharedCap] = await Promise.all([
    deps.limits.find(userId, "user"),
    sharedLimitOf(deps, userId),
    deps.limits.find(userId, "global_cap"),
  ]);
  return { own: own ?? NO_LIMIT, shared, sharedCap: sharedCap ?? NO_LIMIT };
}

export function makeEnsureAiAllowed(deps: LimitDeps) {
  return async function ensureAiAllowed(userId: string, keySource: KeySource): Promise<void> {
    const limit = await resolveLimit(deps, userId, keySource);
    const person = await deps.personOf(userId);
    if (!person) throw new AppError("FORBIDDEN");
    const periods = periodsFor(deps.clock.now(), person.timezone);
    const events = await deps.usage.listEvents(userId, periods.monthStart);
    const today = sumEvents(events.filter((event) => event.createdAt >= periods.dayStart));
    const state = checkLimit(limit, today, sumEvents(events));
    if (state.blocked) throw new AppError("AI_LIMIT_REACHED", BLOCKED_DETAIL[state.blocked]);
  };
}

type Actor = { userId: string; isAdmin: boolean };
export type LimitKey = "own" | "shared";
export type LimitTarget =
  { scope: "own"; key: LimitKey } | { scope: "person"; userId: string; key: LimitKey };

const OWN_SLOT: Record<LimitKey, LimitSlot> = { own: "user", shared: "global_cap" };
const ADMIN_SLOT: Record<LimitKey, LimitSlot> = { own: "user", shared: "global" };

export function makeSetAiUsageLimit(deps: Pick<LimitDeps, "limits" | "clock">) {
  return async function setAiUsageLimit(input: {
    actor: Actor;
    target: LimitTarget;
    limit: unknown;
  }): Promise<UsageLimit> {
    const parsed = usageLimitSchema.safeParse(input.limit);
    if (!parsed.success) throw new AppError("INVALID_INPUT", "limitInvalid");
    const target = input.target;
    if (target.scope === "person") {
      if (!input.actor.isAdmin) throw new AppError("FORBIDDEN", "adminOnlySharedLimit");
      await deps.limits.save(
        target.userId,
        ADMIN_SLOT[target.key],
        parsed.data,
        input.actor.userId,
        deps.clock.now(),
      );
    } else {
      await deps.limits.save(
        input.actor.userId,
        OWN_SLOT[target.key],
        parsed.data,
        input.actor.userId,
        deps.clock.now(),
      );
    }
    return parsed.data;
  };
}
