import { z } from "zod";

export const AI_OPERATIONS = [
  "cards",
  "translation",
  "tutor",
  "lesson_plan",
  "suggestions",
  "embeddings",
] as const;
export type AiOperation = (typeof AI_OPERATIONS)[number];

export const OPERATION_LABELS: Record<AiOperation, string> = {
  cards: "Cards",
  translation: "Tradução",
  tutor: "Tutor",
  lesson_plan: "Plano de aula",
  suggestions: "Sugestões",
  embeddings: "Embeddings",
};

export const KEY_SOURCES = ["user", "global"] as const;
export type KeySource = (typeof KEY_SOURCES)[number];

const TOKENS_PER_MILLION = 1_000_000;
const MAX_USD_PER_MILLION = 10_000;

export const modelPriceSchema = z.object({
  provider: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(120),
  inputUsdPerMillion: z.number().min(0).max(MAX_USD_PER_MILLION),
  outputUsdPerMillion: z.number().min(0).max(MAX_USD_PER_MILLION),
});
export type ModelPrice = z.infer<typeof modelPriceSchema>;

export const DEFAULT_PRICES_DATE = new Date("2026-10-01T00:00:00Z");

export const DEFAULT_MODEL_PRICES: ModelPrice[] = [
  { provider: "google", model: "gemini-2.5-flash", inputUsdPerMillion: 0.3, outputUsdPerMillion: 2.5 },
  { provider: "google", model: "gemini-flash-latest", inputUsdPerMillion: 0.3, outputUsdPerMillion: 2.5 },
  { provider: "google", model: "gemini-2.5-flash-lite", inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.4 },
  { provider: "google", model: "gemini-embedding-001", inputUsdPerMillion: 0.15, outputUsdPerMillion: 0 },
];

export function findDefaultPrice(provider: string, model: string): ModelPrice | null {
  return DEFAULT_MODEL_PRICES.find((price) => price.provider === provider && price.model === model) ?? null;
}

export type TokenUsage = { inputTokens: number; outputTokens: number };

export function estimateCostUsd(price: ModelPrice | null, usage: TokenUsage): number | null {
  if (!price) return null;
  const input = (usage.inputTokens / TOKENS_PER_MILLION) * price.inputUsdPerMillion;
  const output = (usage.outputTokens / TOKENS_PER_MILLION) * price.outputUsdPerMillion;
  return input + output;
}

export type AiUsageEvent = {
  id: string;
  userId: string;
  provider: string;
  model: string;
  operation: AiOperation;
  keySource: KeySource;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | null;
  createdAt: Date;
};
