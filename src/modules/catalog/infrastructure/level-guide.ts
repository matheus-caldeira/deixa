import { z } from "zod";
import type { StudyLanguage } from "@/shared/study-languages";
import type { MediaType } from "../domain/catalog";
import { RATING_KEY_PATTERN, levelRangeTextSchema, type LevelRange } from "../domain/level-ratings";
import type { BuiltinLevelGuide } from "../application/level-sources";
import type {
  DiscoverQuery,
  EpisodeMetadata,
  MetadataProvider,
  WorkCandidate,
  WorkDetails,
  WorkPage,
  WorkSummary,
} from "../application/ports";
import rawGuide from "./level-guide.json";

const guideSchema = z.record(z.string().regex(RATING_KEY_PATTERN), levelRangeTextSchema);

const guide: Record<string, LevelRange> = guideSchema.parse(rawGuide);

export const builtinLevelGuide: BuiltinLevelGuide = {
  count: Object.keys(guide).length,
  ids: () => Object.keys(guide),
  rangeOf: (externalId) => guide[externalId] ?? null,
};

export function levelGuideEntries(): { externalId: string; range: LevelRange }[] {
  return Object.entries(guide).map(([externalId, range]) => ({ externalId, range }));
}

export type LevelRangeResolver = (externalIds: readonly string[]) => Promise<ReadonlyMap<string, LevelRange>>;

const KIND_BY_TYPE: Record<MediaType, string> = { series: "tv", movie: "movie" };

const belongs = (work: WorkSummary) => work.externalId.startsWith(`${KIND_BY_TYPE[work.type]}:`);

export class LevelGuidedMetadataProvider implements MetadataProvider {
  constructor(
    private readonly inner: MetadataProvider,
    private readonly resolve: LevelRangeResolver,
  ) {}

  get name() {
    return this.inner.name;
  }

  private async guided<Work extends WorkSummary>(works: Work[]): Promise<Work[]> {
    const ranges = await this.resolve(works.filter(belongs).map((work) => work.externalId));
    return works.map((work) => {
      const range = belongs(work) ? ranges.get(work.externalId) : undefined;
      return range ? { ...work, levelRange: range } : work;
    });
  }

  async searchWorks(query: string): Promise<WorkSummary[]> {
    return this.guided(await this.inner.searchWorks(query));
  }

  async getWork(type: MediaType, externalId: string): Promise<WorkDetails> {
    const details = await this.inner.getWork(type, externalId);
    const range = belongs(details)
      ? (await this.resolve([details.externalId])).get(details.externalId)
      : undefined;
    return range ? { ...details, levelRange: range } : details;
  }

  getSeasonEpisodes(externalId: string, seasonNumber: number): Promise<EpisodeMetadata[]> {
    return this.inner.getSeasonEpisodes(externalId, seasonNumber);
  }

  async listRelatedWorks(type: MediaType, externalId: string): Promise<WorkCandidate[]> {
    return this.guided(await this.inner.listRelatedWorks(type, externalId));
  }

  async listPopularWorks(language: StudyLanguage): Promise<WorkCandidate[]> {
    return this.guided(await this.inner.listPopularWorks(language));
  }

  async discoverWorks(query: DiscoverQuery): Promise<WorkPage> {
    const page = await this.inner.discoverWorks(query);
    return { ...page, works: await this.guided(page.works) };
  }
}
