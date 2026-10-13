import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { EmbeddingModel, LanguageModel } from "ai";

export type AiProviderName = "google";

export type AiAccess = { provider: AiProviderName; apiKey: string };

export function languageModel(access: AiAccess, modelId: string): LanguageModel {
  return createGoogleGenerativeAI({ apiKey: access.apiKey })(modelId);
}

export function embeddingModel(access: AiAccess, modelId: string): EmbeddingModel {
  return createGoogleGenerativeAI({ apiKey: access.apiKey }).embedding(modelId);
}
