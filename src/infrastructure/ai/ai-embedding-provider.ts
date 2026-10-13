import { APICallError, embedMany } from "ai";
import type { EmbeddingProvider } from "@/modules/recommendations";
import { AppError } from "@/shared/errors";
import { embeddingModel, type AiAccess } from "./models";

const MODEL = "gemini-embedding-001";
const DIMENSIONS = 256;
const BATCH_SIZE = 50;
const TIMEOUT_MS = 30_000;
const MAX_TEXT_CHARS = 2000;
const KEY_REJECTED = [400, 401, 403];

export class AiEmbeddingProvider implements EmbeddingProvider {
  readonly name = "gemini" as const;
  readonly model = `${MODEL}-${DIMENSIONS}`;

  constructor(private readonly access: AiAccess) {}

  private async embedBatch(texts: string[]): Promise<number[][]> {
    let embeddings: number[][];
    try {
      const result = await embedMany({
        model: embeddingModel(this.access, MODEL),
        values: texts.map((text) => text.slice(0, MAX_TEXT_CHARS)),
        providerOptions: { google: { outputDimensionality: DIMENSIONS, taskType: "SEMANTIC_SIMILARITY" } },
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        maxRetries: 0,
      });
      embeddings = result.embeddings;
    } catch (error) {
      const status = APICallError.isInstance(error) ? (error.statusCode ?? 0) : 0;
      if (KEY_REJECTED.includes(status)) {
        throw new AppError("AI_KEY_REJECTED", "O provedor recusou a chave de IA ao gerar vetores.");
      }
      if (status > 0) throw new AppError("LLM_FAILED", `O serviço de vetores da IA respondeu ${status}.`);
      throw new AppError("LLM_FAILED", "O serviço de vetores da IA não respondeu.");
    }
    const wellFormed =
      embeddings.length === texts.length && embeddings.every((vector) => vector.length === DIMENSIONS);
    if (!wellFormed) {
      throw new AppError("LLM_INVALID_OUTPUT", "O serviço de vetores devolveu um formato inesperado.");
    }
    return embeddings;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let start = 0; start < texts.length; start += BATCH_SIZE) {
      vectors.push(...(await this.embedBatch(texts.slice(start, start + BATCH_SIZE))));
    }
    return vectors;
  }
}
