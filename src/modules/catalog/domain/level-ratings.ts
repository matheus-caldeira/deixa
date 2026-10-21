import { z } from "zod";
import { CEFR_LEVELS, levelIndex, type CefrLevel } from "@/shared/levels";

export type LevelRange = readonly [CefrLevel, CefrLevel];

export const LEVEL_SOURCE_STATUSES = ["PENDING", "READY", "FAILED"] as const;
export type LevelSourceStatus = (typeof LEVEL_SOURCE_STATUSES)[number];

export const MAX_LEVEL_SOURCES = 50;
export const MAX_LEVEL_SOURCE_DEPTH = 2;
export const MAX_LEVEL_SOURCE_BYTES = 5 * 1024 * 1024;
export const MAX_LEVEL_SOURCE_URL_LENGTH = 2048;
export const MAX_LEVEL_SOURCE_NAME_LENGTH = 80;
export const MAX_LEVEL_SOURCE_ERROR_LENGTH = 200;

export const RATING_KEY_PATTERN = /^(tv|movie):\d+$/;

const levelSchema = z.enum(CEFR_LEVELS);

export const levelRangeTextSchema = z
  .string()
  .transform((value) =>
    value
      .trim()
      .toUpperCase()
      .split(/\s*[-–]\s*/),
  )
  .transform((parts) => (parts.length === 1 ? [parts[0], parts[0]] : parts))
  .pipe(z.tuple([levelSchema, levelSchema]))
  .refine(([min, max]) => levelIndex(min) <= levelIndex(max));

const rangeValueSchema = z.union([
  levelRangeTextSchema,
  z
    .object({ min: levelSchema, max: levelSchema })
    .refine(({ min, max }) => levelIndex(min) <= levelIndex(max))
    .transform(({ min, max }): LevelRange => [min, max]),
]);

export type LevelSourceDocument = {
  name: string | null;
  ratings: Map<string, LevelRange>;
  sources: string[];
  rejected: number;
};

const documentSchema = z.object({
  name: z.string().nullish(),
  ratings: z.record(z.string(), z.unknown()).nullish(),
  sources: z.array(z.string()).nullish(),
});

export function isLevelSourceUrl(value: string): boolean {
  if (value.length > MAX_LEVEL_SOURCE_URL_LENGTH) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

function readRatings(raw: Record<string, unknown>): { ratings: Map<string, LevelRange>; rejected: number } {
  const ratings = new Map<string, LevelRange>();
  let rejected = 0;
  for (const [key, value] of Object.entries(raw)) {
    const range = rangeValueSchema.safeParse(value);
    if (RATING_KEY_PATTERN.test(key) && range.success) ratings.set(key, range.data);
    else rejected += 1;
  }
  return { ratings, rejected };
}

export function parseLevelSourceDocument(input: unknown): LevelSourceDocument | null {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return null;
  if ("ratings" in input || "sources" in input) {
    const structured = documentSchema.safeParse(input);
    if (!structured.success) return null;
    const { ratings, rejected } = readRatings(structured.data.ratings ?? {});
    const sources = (structured.data.sources ?? []).map((url) => url.trim()).filter(isLevelSourceUrl);
    const name = structured.data.name?.trim().slice(0, MAX_LEVEL_SOURCE_NAME_LENGTH) || null;
    return {
      name,
      ratings,
      sources: [...new Set(sources)],
      rejected: rejected + (structured.data.sources?.length ?? 0) - sources.length,
    };
  }
  const { ratings, rejected } = readRatings(input as Record<string, unknown>);
  return { name: null, ratings, sources: [], rejected };
}

function medianIndex(values: number[], pick: "lower" | "upper"): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = (sorted.length - 1) / 2;
  return sorted[pick === "lower" ? Math.floor(middle) : Math.ceil(middle)] ?? 0;
}

export function aggregateLevelRanges(ranges: readonly LevelRange[]): LevelRange | null {
  if (ranges.length === 0) return null;
  const min = medianIndex(
    ranges.map(([low]) => levelIndex(low)),
    "lower",
  );
  const max = Math.max(
    min,
    medianIndex(
      ranges.map(([, high]) => levelIndex(high)),
      "upper",
    ),
  );
  return [CEFR_LEVELS[min] ?? "A1", CEFR_LEVELS[max] ?? "C2"];
}

export function sameRange(left: LevelRange, right: LevelRange): boolean {
  return left[0] === right[0] && left[1] === right[1];
}
