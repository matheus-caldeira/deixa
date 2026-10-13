import { z } from "zod";
import { episodeRefSchema, packagedCardSchema } from "./package";

export const PERSONAL_PATH = "personal.enc";
export const PERSONAL_META_PATH = "personal.json";
export const PERSONAL_FORMAT_VERSION = 1;
export const MAX_PERSONAL_BYTES = 50_000_000;

const ISO = z.string().datetime();
const SHORT = z.string().max(300);

export const personalMetaSchema = z.object({
  email: z
    .string()
    .email()
    .max(SHORT.maxLength ?? 300),
  exportedAt: ISO,
  includesCredentials: z.boolean(),
});
export type PersonalMeta = z.infer<typeof personalMetaSchema>;

const cardItemSchema = z.discriminatedUnion("origin", [
  z.object({ origin: z.literal("episode"), ref: episodeRefSchema, card: packagedCardSchema }),
  z.object({
    origin: z.literal("standalone"),
    term: SHORT,
    meaning: z.string().max(4000),
    context: z.string().max(4000).nullable(),
    source: SHORT,
  }),
]);

export const personalCardSchema = z.object({
  item: cardItemSchema,
  sourceKind: SHORT,
  dueAt: ISO,
  intervalDays: z.number().min(0),
  repetitions: z.number().int().min(0),
  lapses: z.number().int().min(0),
  stability: z.number().min(0),
  difficulty: z.number().min(0),
  createdAt: ISO,
  reviews: z
    .array(
      z.object({
        rating: z.enum(["again", "hard", "good", "easy"]),
        responseTimeMs: z.number().int().min(0).nullable(),
        reviewedAt: ISO,
      }),
    )
    .max(10_000),
});
export type PersonalCard = z.infer<typeof personalCardSchema>;

export const personalDataSchema = z.object({
  version: z.literal(PERSONAL_FORMAT_VERSION),
  email: z.string().email(),
  exportedAt: ISO,
  preferences: z.object({
    level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
    dailyGoal: z.number().int().min(0),
    preferredAccent: z.enum(["US", "UK"]),
    audioSpeed: z.number().min(0.1).max(3),
    timezone: SHORT,
  }),
  highlights: z
    .array(
      z.object({
        ref: episodeRefSchema,
        cueSequence: z.number().int().min(1),
        startToken: z.number().int().min(0),
        endToken: z.number().int().min(0),
        kind: z.enum(["word", "phrase", "line"]),
        shareScope: z.enum(["private", "catalog"]),
        createdAt: ISO,
      }),
    )
    .max(100_000),
  cards: z.array(personalCardSchema).max(50_000),
  progress: z
    .array(
      z.object({
        ref: episodeRefSchema,
        status: SHORT,
        progressPercent: z.number().int().min(0).max(100),
        lastPositionMs: z.number().int().min(0).nullable(),
        completedAt: ISO.nullable(),
        updatedAt: ISO,
      }),
    )
    .max(100_000),
  xp: z
    .array(z.object({ source: SHORT, sourceId: SHORT, amount: z.number().int(), createdAt: ISO }))
    .max(500_000),
  snapshot: z.object({ data: z.unknown(), updatedAt: ISO }).nullable(),
  credentials: z.array(z.object({ service: SHORT, secret: z.string().max(4000) })).max(20),
});
export type PersonalData = z.infer<typeof personalDataSchema>;
