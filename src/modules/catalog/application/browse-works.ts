import type { StudyLanguage } from "@/shared/study-languages";
import type { MediaType } from "../domain/catalog";
import type { LevelRange } from "../domain/level-ratings";
import {
  makeResolveLevelRatings,
  type AiLevelRatingRepository,
  type BuiltinLevelGuide,
  type LevelRating,
  type LevelSourceRepository,
} from "./level-sources";
import type {
  CatalogRepository,
  EpisodeLevelMeasurementRepository,
  DiscoverSort,
  MetadataProvider,
  WorkSummary,
} from "./ports";

const MIN_QUERY_LENGTH = 2;

type Deps = {
  metadata: MetadataProvider;
  catalog: CatalogRepository;
  sources: LevelSourceRepository;
  builtin: BuiltinLevelGuide;
  aiRatings: AiLevelRatingRepository;
  measured: EpisodeLevelMeasurementRepository;
};

export type BrowsedWork = WorkSummary & {
  voteAverage: number | null;
  catalogMediaId: string | null;
  range: LevelRange | null;
  ratings: LevelRating[];
  aiReason: string | null;
};

export type BrowsePage = { works: BrowsedWork[]; page: number; totalPages: number; searching: boolean };

export function makeBrowseWorks(deps: Deps) {
  const resolve = makeResolveLevelRatings(deps);
  return async function browseWorks(input: {
    query: string;
    type: MediaType;
    language: StudyLanguage | null;
    sort: DiscoverSort;
    page: number;
  }): Promise<BrowsePage> {
    const query = input.query.trim();
    const searching = query.length >= MIN_QUERY_LENGTH;
    const found: {
      works: (WorkSummary & { voteAverage?: number | null })[];
      page: number;
      totalPages: number;
    } = searching
      ? { works: await deps.metadata.searchWorks(query), page: 1, totalPages: 1 }
      : await deps.metadata.discoverWorks({
          type: input.type,
          language: input.language,
          sort: input.sort,
          page: input.page,
        });
    const ids = found.works.map((work) => work.externalId);
    const [resolved, fromAi] = await Promise.all([resolve(ids), deps.aiRatings.ratingsFor(ids)]);
    const works = await Promise.all(
      found.works.map(async (work) => {
        const levels = resolved.get(work.externalId);
        return {
          ...work,
          voteAverage: work.voteAverage ?? null,
          catalogMediaId:
            (await deps.catalog.findMediaByExternal(work.provider, work.externalId))?.id ?? null,
          range: levels?.range ?? null,
          ratings: levels?.ratings ?? [],
          aiReason: fromAi.get(work.externalId)?.reason ?? null,
        };
      }),
    );
    return { works, page: found.page, totalPages: found.totalPages, searching };
  };
}
