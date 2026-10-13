import {
  APICallError,
  JSONParseError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  generateText,
  Output,
  type LanguageModel,
  type ModelMessage,
} from "ai";
import type { AiOperation, AiUsageMeter } from "@/modules/ai-usage";
import { AppError } from "@/shared/errors";
import { languageModel, type AiAccess } from "./models";

const FALLBACK_MODELS: Record<AiAccess["provider"], string[]> = {
  google: ["gemini-flash-latest", "gemini-2.5-flash-lite"],
};
const KEY_REJECTED = [400, 401, 403];
const TRY_NEXT_MODEL = [404, 429, 500, 503];
const RATE_LIMITED = 429;

export type JsonRequest = {
  access: AiAccess;
  model: string;
  system: string;
  messages: ModelMessage[];
  timeoutMs: number;
  temperature: number;
};

export type ModelFactory = (access: AiAccess, modelId: string) => LanguageModel;

export type AiDeps = { meter: AiUsageMeter; createModel?: ModelFactory };

function statusOf(error: unknown): number {
  return APICallError.isInstance(error) ? (error.statusCode ?? 0) : 0;
}

function isMalformedOutput(error: unknown): boolean {
  return (
    NoObjectGeneratedError.isInstance(error) ||
    NoOutputGeneratedError.isInstance(error) ||
    JSONParseError.isInstance(error)
  );
}

async function callModel(
  request: JsonRequest,
  model: LanguageModel,
  modelId: string,
  operation: AiOperation,
  meter: AiUsageMeter,
): Promise<unknown> {
  try {
    const result = await generateText({
      model,
      instructions: request.system,
      messages: request.messages,
      output: Output.json(),
      temperature: request.temperature,
      timeout: request.timeoutMs,
      maxRetries: 0,
    });
    await meter.record({
      provider: request.access.provider,
      model: modelId,
      operation,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
    });
    return result.output;
  } catch (error) {
    if (!isMalformedOutput(error)) throw error;
    throw new AppError("LLM_INVALID_OUTPUT", "A IA devolveu uma resposta fora do formato.");
  }
}

export async function generateJson(
  request: JsonRequest,
  operation: AiOperation,
  deps: AiDeps,
): Promise<unknown> {
  const createModel = deps.createModel ?? languageModel;
  const fallbacks = FALLBACK_MODELS[request.access.provider].filter((id) => id !== request.model);
  let lastStatus = 0;
  for (const modelId of [request.model, ...fallbacks]) {
    try {
      return await callModel(request, createModel(request.access, modelId), modelId, operation, deps.meter);
    } catch (error) {
      if (error instanceof AppError) throw error;
      lastStatus = statusOf(error);
      if (TRY_NEXT_MODEL.includes(lastStatus) || lastStatus === 0) continue;
      if (KEY_REJECTED.includes(lastStatus)) {
        throw new AppError("AI_KEY_REJECTED", "O provedor recusou a chave de IA. Confira a chave no perfil.");
      }
      throw new AppError("LLM_FAILED", `A IA respondeu com erro (${lastStatus}).`);
    }
  }
  throw new AppError(
    "LLM_FAILED",
    lastStatus === RATE_LIMITED
      ? "A cota diária da chave de IA acabou. Tente de novo amanhã ou use outra chave."
      : "A IA não respondeu. Tente de novo em instantes.",
  );
}
