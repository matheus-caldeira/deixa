import type { Clock } from "@/shared/clock";
import { AppError } from "@/shared/errors";
import {
  NO_LIMIT,
  checkLimit,
  periodsFor,
  sumEvents,
  usageLimitSchema,
  type LimitPeriod,
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

const BLOCKED_MESSAGES: Record<LimitPeriod, string> = {
  day: "Você chegou ao limite de IA de hoje. Ela volta amanhã; ler, marcar e revisar continuam funcionando.",
  month:
    "Você chegou ao limite de IA deste mês. Ela volta no dia 1º; ler, marcar e revisar continuam funcionando.",
};

export async function resolveLimit(
  deps: LimitDeps,
  userId: string,
  keySource: KeySource,
): Promise<UsageLimit> {
  const own = await deps.limits.find(userId, keySource);
  if (own) return own;
  return keySource === "global" ? deps.sharedDefault() : NO_LIMIT;
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
    if (state.blocked) throw new AppError("AI_LIMIT_REACHED", BLOCKED_MESSAGES[state.blocked]);
  };
}

type Actor = { userId: string; isAdmin: boolean };
export type LimitTarget = { scope: "own" } | { scope: "shared"; userId: string };

export function makeSetAiUsageLimit(deps: Pick<LimitDeps, "limits" | "clock">) {
  return async function setAiUsageLimit(input: {
    actor: Actor;
    target: LimitTarget;
    limit: unknown;
  }): Promise<UsageLimit> {
    const parsed = usageLimitSchema.safeParse(input.limit);
    if (!parsed.success) throw new AppError("INVALID_INPUT", "Confira os valores do limite.");
    if (input.target.scope === "shared") {
      if (!input.actor.isAdmin) {
        throw new AppError("FORBIDDEN", "Só o administrador define o limite da chave compartilhada.");
      }
      await deps.limits.save(
        input.target.userId,
        "global",
        parsed.data,
        input.actor.userId,
        deps.clock.now(),
      );
    } else {
      await deps.limits.save(input.actor.userId, "user", parsed.data, input.actor.userId, deps.clock.now());
    }
    return parsed.data;
  };
}
