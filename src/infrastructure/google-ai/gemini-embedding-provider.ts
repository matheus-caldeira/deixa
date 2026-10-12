import { z } from "zod";
import type { EmbeddingProvider } from "@/modules/recommendations";
import { AppError } from "@/shared/errors";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = "gemini-embedding-001";
const DIMENSIONS = 256;
const BATCH_SIZE = 50;
const TIMEOUT_MS = 30_000;
const MAX_TEXT_CHARS = 2000;
const KEY_REJECTED = [400, 401, 403];

const responseSchema = z.object({
  embeddings: z.array(z.object({ values: z.array(z.number()).length(DIMENSIONS) })),
});

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly name = "gemini" as const;
  readonly model = `${MODEL}-${DIMENSIONS}`;

  constructor(private readonly apiKey: string) {}

  private async embedBatch(texts: string[]): Promise<number[][]> {
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/models/${MODEL}:batchEmbedContents`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          requests: texts.map((text) => ({
            model: `models/${MODEL}`,
            content: { parts: [{ text: text.slice(0, MAX_TEXT_CHARS) }] },
            taskType: "SEMANTIC_SIMILARITY",
            outputDimensionality: DIMENSIONS,
          })),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new AppError("LLM_FAILED", "O serviço de vetores da IA não respondeu.");
    }
    if (KEY_REJECTED.includes(response.status)) {
      throw new AppError("AI_KEY_REJECTED", "O Google recusou a chave de IA ao gerar vetores.");
    }
    if (!response.ok) {
      throw new AppError("LLM_FAILED", `O serviço de vetores da IA respondeu ${response.status}.`);
    }
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.embeddings.length !== texts.length) {
      throw new AppError("LLM_INVALID_OUTPUT", "O serviço de vetores devolveu um formato inesperado.");
    }
    return parsed.data.embeddings.map((embedding) => embedding.values);
  }

  async embed(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let start = 0; start < texts.length; start += BATCH_SIZE) {
      vectors.push(...(await this.embedBatch(texts.slice(start, start + BATCH_SIZE))));
    }
    return vectors;
  }
}
