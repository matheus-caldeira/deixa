import type { AiUsageEvent, ModelPrice } from "../../domain/usage";
import type {
  AiUsageMeter,
  AiUsageRepository,
  MeasuredCall,
  ModelPriceRepository,
  StoredModelPrice,
} from "../ports";

export class InMemoryAiUsageRepository implements AiUsageRepository {
  readonly events: AiUsageEvent[] = [];

  async record(event: AiUsageEvent): Promise<void> {
    this.events.push(event);
  }

  async listEvents(userId: string, since: Date): Promise<AiUsageEvent[]> {
    return this.events.filter((event) => event.userId === userId && event.createdAt >= since);
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

export class RecordingMeter implements AiUsageMeter {
  readonly calls: MeasuredCall[] = [];

  async record(call: MeasuredCall): Promise<void> {
    this.calls.push(call);
  }
}
