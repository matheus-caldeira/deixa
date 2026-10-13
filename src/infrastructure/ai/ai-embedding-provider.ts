import { APICallError, embedMany } from "ai";
import type { AiUsageMeter } from "@/modules/ai-usage";
import type { EmbeddingProvider } from "@/modules/recommendations";
import { AppError } from "@/shared/errors";
import { embeddingModel, type AiAccess } from "./models";

const DIMENSIONS = 256;
const BATCH_SIZE = 50;
const TIMEOUT_MS = 30_000;
const MAX_TEXT_CHARS = 2000;
const KEY_REJECTED = [400, 401, 403];
const FIXED_DIMENSION_PROVIDERS = new Set<AiAccess["provider"]>(["gemini", "openai"]);

export class AiEmbeddingProvider implements EmbeddingProvider {
  readonly name: string;
  readonly model: string;

  constructor(
    private readonly access: AiAccess,
    private readonly modelId: string,
    private readonly meter: AiUsageMeter,
  ) {
    this.name = access.provider;
    const suffix = FIXED_DIMENSION_PROVIDERS.has(access.provider) ? `-${DIMENSIONS}` : "";
    this.model = `${access.provider}/${modelId}${suffix}`;
  }

  private async embedBatch(texts: string[]): Promise<number[][]> {
    const model = embeddingModel(this.access, this.modelId);
    if (!model) throw new AppError("LLM_FAILED", "Esse provedor não oferece embeddings.");
    const fixed = FIXED_DIMENSION_PROVIDERS.has(this.access.provider);
    let embeddings: number[][];
    let tokens = 0;
    try {
      const result = await embedMany({
        model,
        values: texts.map((text) => text.slice(0, MAX_TEXT_CHARS)),
        dimensions: fixed ? DIMENSIONS : undefined,
        providerOptions:
          this.access.provider === "gemini"
            ? { google: { outputDimensionality: DIMENSIONS, taskType: "SEMANTIC_SIMILARITY" } }
            : undefined,
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        maxRetries: 0,
      });
      embeddings = result.embeddings;
      tokens = result.usage.tokens;
    } catch (error) {
      const status = APICallError.isInstance(error) ? (error.statusCode ?? 0) : 0;
      if (KEY_REJECTED.includes(status)) {
        throw new AppError("AI_KEY_REJECTED", "O provedor recusou a chave de IA ao gerar vetores.");
      }
      if (status > 0) throw new AppError("LLM_FAILED", `O serviço de vetores da IA respondeu ${status}.`);
      throw new AppError("LLM_FAILED", "O serviço de vetores da IA não respondeu.");
    }
    const width = fixed ? DIMENSIONS : (embeddings[0]?.length ?? 0);
    const wellFormed =
      embeddings.length === texts.length &&
      width > 0 &&
      embeddings.every((vector) => vector.length === width);
    if (!wellFormed) {
      throw new AppError("LLM_INVALID_OUTPUT", "O serviço de vetores devolveu um formato inesperado.");
    }
    await this.meter.record({
      provider: this.access.provider,
      model: this.modelId,
      operation: "embeddings",
      inputTokens: tokens,
      outputTokens: 0,
    });
    return embeddings;
  }

  async embed(texts: string[]): Promise<number[][]> {
    await this.meter.ensureAllowed();
    const vectors: number[][] = [];
    for (let start = 0; start < texts.length; start += BATCH_SIZE) {
      vectors.push(...(await this.embedBatch(texts.slice(start, start + BATCH_SIZE))));
    }
    return vectors;
  }
}
