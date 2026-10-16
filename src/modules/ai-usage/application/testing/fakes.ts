import { NO_LIMIT, type LimitSlot, type UsageLimit } from "../../domain/limits";
import type { AiUsageEvent, ModelPrice } from "../../domain/usage";
import type {
  AiUsageMeter,
  AiUsageRepository,
  MeasuredCall,
  ModelPriceRepository,
  StoredModelPrice,
  UsageLimitRepository,
  UsagePerson,
  UserTotals,
} from "../ports";

export class InMemoryAiUsageRepository implements AiUsageRepository {
  readonly events: AiUsageEvent[] = [];

  async record(event: AiUsageEvent): Promise<void> {
    this.events.push(event);
  }

  async listEvents(userId: string, since: Date): Promise<AiUsageEvent[]> {
    return this.events.filter((event) => event.userId === userId && event.createdAt >= since);
  }

  async totalsByUser(since: Date): Promise<UserTotals[]> {
    const byUser = new Map<string, UserTotals>();
    for (const event of this.events.filter((candidate) => candidate.createdAt >= since)) {
      const entry = byUser.get(event.userId) ?? {
        userId: event.userId,
        usd: 0,
        tokens: 0,
        unknownCostCalls: 0,
      };
      entry.usd += event.estimatedCostUsd ?? 0;
      entry.tokens += event.inputTokens + event.outputTokens;
      entry.unknownCostCalls += event.estimatedCostUsd === null ? 1 : 0;
      byUser.set(event.userId, entry);
    }
    return [...byUser.values()];
  }
}

export class InMemoryModelPriceRepository implements ModelPriceRepository {
  private readonly prices = new Map<string, StoredModelPrice>();

  async find(provider: string, model: string): Promise<StoredModelPrice | null> {
    return this.prices.get(`${provider}/${model}`) ?? null;
  }

  async list(): Promise<StoredModelPrice[]> {
    return [...this.prices.values()];
  }

  async save(price: ModelPrice, _updatedBy: string, now: Date): Promise<void> {
    this.prices.set(`${price.provider}/${price.model}`, { ...price, updatedAt: now });
  }
}

export class InMemoryUsageLimitRepository implements UsageLimitRepository {
  private readonly limits = new Map<string, UsageLimit>();

  async find(userId: string, slot: LimitSlot): Promise<UsageLimit | null> {
    return this.limits.get(`${userId}/${slot}`) ?? null;
  }

  async save(userId: string, slot: LimitSlot, limit: UsageLimit): Promise<void> {
    this.limits.set(`${userId}/${slot}`, limit);
  }
}

export class RecordingMeter implements AiUsageMeter {
  readonly calls: MeasuredCall[] = [];
  checks = 0;

  async ensureAllowed(): Promise<void> {
    this.checks += 1;
  }

  async record(call: MeasuredCall): Promise<void> {
    this.calls.push(call);
  }
}

export const person = (id: string, timezone = "America/Sao_Paulo"): UsagePerson => ({
  id,
  name: id,
  avatarColor: "#000",
  timezone,
});

export const sharedDefault = async (): Promise<UsageLimit> => NO_LIMIT;
