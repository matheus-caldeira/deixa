import type { UsageLimit } from "../domain/limits";
import type { AiOperation, AiUsageEvent, KeySource, ModelPrice } from "../domain/usage";

export type StoredModelPrice = ModelPrice & { updatedAt: Date };

export type UserTotals = { userId: string; usd: number; tokens: number; unknownCostCalls: number };

export interface AiUsageRepository {
  record(event: AiUsageEvent): Promise<void>;
  listEvents(userId: string, since: Date): Promise<AiUsageEvent[]>;
  totalsByUser(since: Date): Promise<UserTotals[]>;
}

export interface ModelPriceRepository {
  find(provider: string, model: string): Promise<StoredModelPrice | null>;
  list(): Promise<StoredModelPrice[]>;
  save(price: ModelPrice, updatedBy: string, now: Date): Promise<void>;
}

export interface UsageLimitRepository {
  find(userId: string, keySource: KeySource): Promise<UsageLimit | null>;
  save(userId: string, keySource: KeySource, limit: UsageLimit, updatedBy: string, now: Date): Promise<void>;
}

export type MeasuredCall = {
  provider: string;
  model: string;
  operation: AiOperation;
  inputTokens: number;
  outputTokens: number;
};

export interface AiUsageMeter {
  ensureAllowed(): Promise<void>;
  record(call: MeasuredCall): Promise<void>;
}

export type UsagePerson = { id: string; name: string; avatarColor: string; timezone: string };
