export type Vector = readonly number[];

export const LOCAL_EMBEDDING_DIMENSIONS = 256;
const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;
const MIN_TOKEN_LENGTH = 3;
const WORD = /[\p{L}\p{N}]+/gu;

export function magnitude(vector: Vector): number {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

export function cosine(left: Vector, right: Vector): number {
  if (left.length !== right.length || left.length === 0) return 0;
  const scale = magnitude(left) * magnitude(right);
  if (scale === 0) return 0;
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0) / scale;
}

export function weightedCentroid(entries: readonly { vector: Vector; weight: number }[]): Vector | null {
  const usable = entries.filter((entry) => entry.weight > 0 && magnitude(entry.vector) > 0);
  const first = usable[0];
  if (!first) return null;
  const total = new Array<number>(first.vector.length).fill(0);
  for (const { vector, weight } of usable) {
    if (vector.length !== total.length) continue;
    const scale = weight / magnitude(vector);
    vector.forEach((value, index) => {
      total[index] = (total[index] ?? 0) + value * scale;
    });
  }
  return magnitude(total) > 0 ? total : null;
}

function hashToken(token: string): number {
  let hash = FNV_OFFSET;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

export function hashEmbedding(text: string, dimensions = LOCAL_EMBEDDING_DIMENSIONS): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const tokens = (text.toLowerCase().match(WORD) ?? []).filter((token) => token.length >= MIN_TOKEN_LENGTH);
  for (const token of tokens) {
    const hash = hashToken(token);
    const slot = hash % dimensions;
    vector[slot] = (vector[slot] ?? 0) + ((hash >>> 16) % 2 === 0 ? 1 : -1);
  }
  return vector;
}
