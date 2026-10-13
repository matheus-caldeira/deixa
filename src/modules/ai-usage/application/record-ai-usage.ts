import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import { estimateCostUsd, findDefaultPrice, type KeySource } from "../domain/usage";
import type { AiUsageMeter, AiUsageRepository, MeasuredCall, ModelPriceRepository } from "./ports";

type Deps = { usage: AiUsageRepository; prices: ModelPriceRepository; clock: Clock; ids: IdGenerator };

export function makeRecordAiUsage(deps: Deps) {
  return async function recordAiUsage(input: MeasuredCall & { userId: string; keySource: KeySource }) {
    const price =
      (await deps.prices.find(input.provider, input.model)) ?? findDefaultPrice(input.provider, input.model);
    await deps.usage.record({
      id: deps.ids.next(),
      userId: input.userId,
      provider: input.provider,
      model: input.model,
      operation: input.operation,
      keySource: input.keySource,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      estimatedCostUsd: estimateCostUsd(price, input),
      createdAt: deps.clock.now(),
    });
  };
}

export type RecordAiUsage = ReturnType<typeof makeRecordAiUsage>;

export function meterFor(record: RecordAiUsage, userId: string, keySource: KeySource): AiUsageMeter {
  return { record: (call) => record({ ...call, userId, keySource }) };
}
