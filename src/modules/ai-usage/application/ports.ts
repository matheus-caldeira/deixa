import type { AiOperation, AiUsageEvent, ModelPrice } from "../domain/usage";

export type StoredModelPrice = ModelPrice & { updatedAt: Date };

export interface AiUsageRepository {
  record(event: AiUsageEvent): Promise<void>;
  listEvents(userId: string, since: Date): Promise<AiUsageEvent[]>;
}

export interface ModelPriceRepository {
  find(provider: string, model: string): Promise<StoredModelPrice | null>;
  list(): Promise<StoredModelPrice[]>;
  save(price: ModelPrice, updatedBy: string, now: Date): Promise<void>;
}

export type MeasuredCall = {
  provider: string;
  model: string;
  operation: AiOperation;
  inputTokens: number;
  outputTokens: number;
};

export interface AiUsageMeter {
  record(call: MeasuredCall): Promise<void>;
}
