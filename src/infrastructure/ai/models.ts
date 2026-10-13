import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { EmbeddingModel, LanguageModel } from "ai";
import type { AiService } from "@/modules/ai-credentials";

export type AiProviderName = AiService;

export type AiAccess = { provider: AiProviderName; apiKey: string | null; baseUrl: string | null };

const OPENROUTER_URL = "https://openrouter.ai/api/v1";
const OLLAMA_OPENAI_PATH = "/v1";

function compatible(access: AiAccess, name: string, baseURL: string) {
  return createOpenAICompatible({ name, baseURL, apiKey: access.apiKey ?? undefined });
}

function ollamaUrl(access: AiAccess): string {
  const base = access.baseUrl ?? "";
  return base.endsWith(OLLAMA_OPENAI_PATH) ? base : `${base}${OLLAMA_OPENAI_PATH}`;
}

export function languageModel(access: AiAccess, modelId: string): LanguageModel {
  switch (access.provider) {
    case "gemini":
      return createGoogleGenerativeAI({ apiKey: access.apiKey ?? "" })(modelId);
    case "openai":
      return createOpenAI({ apiKey: access.apiKey ?? "" }).chat(modelId);
    case "anthropic":
      return createAnthropic({ apiKey: access.apiKey ?? "" })(modelId);
    case "openrouter":
      return compatible(access, "openrouter", OPENROUTER_URL).chatModel(modelId);
    case "ollama":
      return compatible(access, "ollama", ollamaUrl(access)).chatModel(modelId);
    case "openai_compatible":
      return compatible(access, "openai-compatible", access.baseUrl ?? "").chatModel(modelId);
  }
}

export function embeddingModel(access: AiAccess, modelId: string): EmbeddingModel | null {
  switch (access.provider) {
    case "gemini":
      return createGoogleGenerativeAI({ apiKey: access.apiKey ?? "" }).embedding(modelId);
    case "openai":
      return createOpenAI({ apiKey: access.apiKey ?? "" }).embedding(modelId);
    case "anthropic":
      return null;
    case "openrouter":
      return compatible(access, "openrouter", OPENROUTER_URL).textEmbeddingModel(modelId);
    case "ollama":
      return compatible(access, "ollama", ollamaUrl(access)).textEmbeddingModel(modelId);
    case "openai_compatible":
      return compatible(access, "openai-compatible", access.baseUrl ?? "").textEmbeddingModel(modelId);
  }
}
