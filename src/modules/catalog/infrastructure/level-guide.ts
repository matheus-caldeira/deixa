import { z } from "zod";
import type { StudyLanguage } from "@/shared/study-languages";
import { CEFR_LEVELS, levelIndex, type CefrLevel } from "@/shared/levels";
import type { MediaType } from "../domain/catalog";
import type {
  EpisodeMetadata,
  MetadataProvider,
  WorkCandidate,
  WorkDetails,
  WorkSummary,
} from "../application/ports";
import rawGuide from "./level-guide.json";

export type LevelRange = readonly [CefrLevel, CefrLevel];

const levelSchema = z.enum(CEFR_LEVELS);
const rangeSchema = z
  .string()
  .transform((value) => value.split("-"))
  .pipe(z.tuple([levelSchema, levelSchema]))
  .refine(([min, max]) => levelIndex(min) <= levelIndex(max));
const KIND_BY_TYPE: Record<MediaType, string> = { series: "tv", movie: "movie" };
const guideSchema = z.record(z.string().regex(/^(tv|movie):\d+$/), rangeSchema);

const guide: Record<string, LevelRange> = guideSchema.parse(rawGuide);

export function levelGuideEntries(): { externalId: string; range: LevelRange }[] {
  return Object.entries(guide).map(([externalId, range]) => ({ externalId, range }));
}

export function levelRangeOf(type: MediaType, externalId: string): LevelRange | null {
  return externalId.startsWith(`${KIND_BY_TYPE[type]}:`) ? (guide[externalId] ?? null) : null;
}

function guided<Work extends WorkSummary>(work: Work): Work {
  const range = levelRangeOf(work.type, work.externalId);
  return range ? { ...work, levelRange: range } : work;
}

export class LevelGuidedMetadataProvider implements MetadataProvider {
  constructor(private readonly inner: MetadataProvider) {}

  get name() {
    return this.inner.name;
  }

  async searchWorks(query: string): Promise<WorkSummary[]> {
    return (await this.inner.searchWorks(query)).map(guided);
  }

  async getWork(type: MediaType, externalId: string): Promise<WorkDetails> {
    return guided(await this.inner.getWork(type, externalId));
  }

  getSeasonEpisodes(externalId: string, seasonNumber: number): Promise<EpisodeMetadata[]> {
    return this.inner.getSeasonEpisodes(externalId, seasonNumber);
  }

  async listRelatedWorks(type: MediaType, externalId: string): Promise<WorkCandidate[]> {
    return (await this.inner.listRelatedWorks(type, externalId)).map(guided);
  }

  async listPopularWorks(language: StudyLanguage): Promise<WorkCandidate[]> {
    return (await this.inner.listPopularWorks(language)).map(guided);
  }
}
