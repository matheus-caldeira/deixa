import { z } from "zod";
import { CEFR_LEVELS } from "@/shared/levels";
import { STUDY_LANGUAGES } from "@/shared/study-languages";
import type { JobKind } from "./job";

const language = z.enum(STUDY_LANGUAGES);
const pair = z.object({ target: language, native: language });
const level = z.enum(CEFR_LEVELS);

export const generatePlanPayloadSchema = z.object({
  userId: z.uuid(),
  episodeId: z.uuid(),
  pair,
  level,
  episodeLabel: z.string(),
});

export const cardBatchPayloadSchema = z.object({
  userId: z.uuid(),
  episodeId: z.uuid(),
  batchId: z.uuid(),
  learnerLevel: level,
  pair,
  episodeLabel: z.string(),
});

export const refreshRecommendationsPayloadSchema = z.object({
  userId: z.uuid(),
  level,
  language,
});

export const episodeAudioPayloadSchema = z.object({
  userId: z.uuid(),
  episodeId: z.uuid(),
  language,
  voice: z.object({ voiceId: z.string().min(1), language: z.string().min(1) }),
  episodeLabel: z.string(),
});

export const PAYLOAD_SCHEMAS = {
  generate_plan: generatePlanPayloadSchema,
  card_batch: cardBatchPayloadSchema,
  refresh_recommendations: refreshRecommendationsPayloadSchema,
  episode_audio: episodeAudioPayloadSchema,
} satisfies Record<JobKind, z.ZodType>;

export type JobPayloads = { [K in JobKind]: z.infer<(typeof PAYLOAD_SCHEMAS)[K]> };
