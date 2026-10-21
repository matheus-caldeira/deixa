import { z } from "zod";
import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import { CEFR_LEVELS, levelIndex } from "@/shared/levels";
import { cleanLlmText } from "@/shared/llm-text";
import type { MediaType } from "../domain/catalog";
import { RATING_KEY_PATTERN, sameRange, type LevelRange } from "../domain/level-ratings";
import {
  makeResolveLevelRatings,
  type AiLevelRatingRepository,
  type BuiltinLevelGuide,
  type LevelSourceRepository,
  type WorkLevelRatings,
} from "./level-sources";
import type { CatalogRepository, MetadataProvider } from "./ports";

export const MAX_LEVEL_REASON_CHARS = 280;
const MAX_OVERVIEW_CHARS = 1200;

export type LevelRaterInput = {
  type: MediaType;
  title: string;
  originalTitle: string;
  year: number | null;
  originalLanguage: string | null;
  overview: string;
};

export interface LevelRater {
  readonly model: string;
  rate(input: LevelRaterInput): Promise<unknown>;
}

const levelSchema = z.enum(CEFR_LEVELS);
const raterOutputSchema = z
  .object({ levelMin: levelSchema, levelMax: levelSchema, reason: z.string() })
  .refine((output) => levelIndex(output.levelMin) <= levelIndex(output.levelMax));

type Deps = {
  metadata: MetadataProvider;
  catalog: CatalogRepository;
  sources: LevelSourceRepository;
  builtin: BuiltinLevelGuide;
  aiRatings: AiLevelRatingRepository;
  resolveRater: (userId: string) => Promise<LevelRater | null>;
  clock: Clock;
};

export type RatedWork = WorkLevelRatings & { ai: { range: LevelRange; reason: string } };

export function makeRateWorkLevel(deps: Deps) {
  const resolve = makeResolveLevelRatings(deps);
  return async function rateWorkLevel(input: {
    actor: { userId: string; isAdmin: boolean };
    type: MediaType;
    externalId: string;
  }): Promise<RatedWork> {
    if (!input.actor.isAdmin) throw new AppError("FORBIDDEN", "adminOnlyLevelRating");
    if (deps.metadata.name !== "tmdb" || !RATING_KEY_PATTERN.test(input.externalId)) {
      throw new AppError("INVALID_INPUT");
    }
    const details = await deps.metadata.getWork(input.type, input.externalId);
    if (details.type !== input.type || details.externalId !== input.externalId) {
      throw new AppError("METADATA_NOT_FOUND");
    }
    const rater = await deps.resolveRater(input.actor.userId);
    if (!rater) throw new AppError("LLM_FAILED", "levelRatingNoAi");
    const raw = await rater.rate({
      type: details.type,
      title: details.title,
      originalTitle: details.originalTitle,
      year: details.year,
      originalLanguage: details.originalLanguage ?? null,
      overview: details.overview.slice(0, MAX_OVERVIEW_CHARS),
    });
    const parsed = raterOutputSchema.safeParse(raw);
    const reason = parsed.success ? cleanLlmText(parsed.data.reason, MAX_LEVEL_REASON_CHARS) : null;
    if (!parsed.success || !reason) throw new AppError("LLM_INVALID_OUTPUT");
    const range: LevelRange = [parsed.data.levelMin, parsed.data.levelMax];
    await deps.aiRatings.save({
      externalId: input.externalId,
      range,
      reason,
      model: rater.model,
      ratedBy: input.actor.userId,
      ratedAt: deps.clock.now(),
    });
    const resolved = (await resolve([input.externalId])).get(input.externalId) ?? {
      range,
      ratings: [],
    };
    const media = await deps.catalog.findMediaByExternal("tmdb", input.externalId);
    if (media && resolved.range && !sameRange(resolved.range, [media.levelMin, media.levelMax])) {
      await deps.catalog.updateLevelRange(media.id, resolved.range);
    }
    return { ...resolved, ai: { range, reason } };
  };
}
