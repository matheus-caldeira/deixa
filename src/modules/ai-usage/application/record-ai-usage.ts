import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import { estimateCostUsd, findDefaultPrice, type KeySource } from "../domain/usage";
import type { AiUsageMeter, AiUsageRepository, MeasuredCall, ModelPriceRepository } from "./ports";

type Deps = { usage: AiUsageRepository; prices: ModelPriceRepository; clock: Clock; ids: IdGenerator };

const MAX_TOKENS_PER_CALL = 100_000_000;
const MAX_NAME_CHARS = 120;

export function safeTokenCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.floor(value), MAX_TOKENS_PER_CALL);
}

export function makeRecordAiUsage(deps: Deps) {
  return async function recordAiUsage(input: MeasuredCall & { userId: string; keySource: KeySource }) {
    const provider = input.provider.slice(0, MAX_NAME_CHARS);
    const model = input.model.slice(0, MAX_NAME_CHARS);
    const usage = {
      inputTokens: safeTokenCount(input.inputTokens),
      outputTokens: safeTokenCount(input.outputTokens),
    };
    const price = (await deps.prices.find(provider, model)) ?? findDefaultPrice(provider, model);
    await deps.usage.record({
      id: deps.ids.next(),
      userId: input.userId,
      provider,
      model,
      operation: input.operation,
      keySource: input.keySource,
      ...usage,
      estimatedCostUsd: estimateCostUsd(price, usage),
      createdAt: deps.clock.now(),
    });
  };
}

export type RecordAiUsage = ReturnType<typeof makeRecordAiUsage>;
export type EnsureAiAllowed = (userId: string, keySource: KeySource) => Promise<void>;

export function meterFor(
  record: RecordAiUsage,
  ensureAllowed: EnsureAiAllowed,
  userId: string,
  keySource: KeySource,
): AiUsageMeter {
  return {
    ensureAllowed: () => ensureAllowed(userId, keySource),
    record: (call) => record({ ...call, userId, keySource }),
  };
}
