import type { EmbeddingProvider } from "../application/ports";
import { LOCAL_EMBEDDING_DIMENSIONS, hashEmbedding } from "../domain/vectors";

export class HashEmbeddingProvider implements EmbeddingProvider {
  readonly name = "local" as const;
  readonly model = `hash-${LOCAL_EMBEDDING_DIMENSIONS}-v1`;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => hashEmbedding(text));
  }
}
