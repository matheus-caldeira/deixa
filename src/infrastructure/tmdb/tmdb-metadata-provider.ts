import type {
  DiscoverQuery,
  DiscoverSort,
  EpisodeMetadata,
  MediaType,
  MetadataProvider,
  WorkCandidate,
  WorkDetails,
  WorkPage,
  WorkSummary,
} from "@/modules/catalog";
import { AppError } from "@/shared/errors";
import type { TmdbClient } from "./client";
import {
  mapMovieDetails,
  mapSearchResults,
  mapSeasonEpisodes,
  mapTvDetails,
  mapWorkList,
  needsEnglishFallback,
  seasonNeedsEnglishFallback,
  tmdbNumericId,
} from "./mapping";
import {
  genreListSchema,
  movieDetailsSchema,
  searchMultiSchema,
  seasonDetailsSchema,
  tvDetailsSchema,
  workListSchema,
} from "./schemas";
import type { StudyLanguage } from "@/shared/study-languages";

const PORTUGUESE = "pt-BR";
const ENGLISH = "en-US";
const TMDB_KIND = { series: "tv", movie: "movie" } as const;
const MEDIA_TYPES: readonly MediaType[] = ["series", "movie"];
const TMDB_LANGUAGE: Record<StudyLanguage, string> = { en: "en", "pt-BR": "pt", es: "es", fr: "fr" };
const POPULAR_FILTERS = {
  sort_by: "popularity.desc",
  "vote_count.gte": "400",
  include_adult: "false",
  page: "1",
};

const MAX_DISCOVER_PAGE = 500;
const MIN_VOTES_FOR_RATING = "300";
const DISCOVER_SORT: Record<DiscoverSort, Record<string, string>> = {
  popular: { sort_by: "popularity.desc" },
  votes: { sort_by: "vote_count.desc" },
  rating: { sort_by: "vote_average.desc", "vote_count.gte": MIN_VOTES_FOR_RATING },
};

export class TmdbMetadataProvider implements MetadataProvider {
  readonly name = "tmdb" as const;

  private readonly genreNames = new Map<MediaType, Promise<ReadonlyMap<number, string>>>();

  constructor(private readonly client: TmdbClient) {}

  private genresFor(type: MediaType): Promise<ReadonlyMap<number, string>> {
    const known = this.genreNames.get(type);
    if (known) return known;
    const loading = this.client
      .get(`genre/${TMDB_KIND[type]}/list`, { language: PORTUGUESE }, genreListSchema)
      .then((list) => new Map(list.genres.map((genre) => [genre.id, genre.name])));
    this.genreNames.set(type, loading);
    loading.catch(() => this.genreNames.delete(type));
    return loading;
  }

  async listRelatedWorks(type: MediaType, externalId: string): Promise<WorkCandidate[]> {
    const id = tmdbNumericId(type, externalId);
    if (!id) return [];
    const [list, genres] = await Promise.all([
      this.client.get(
        `${TMDB_KIND[type]}/${id}/recommendations`,
        { language: PORTUGUESE, page: "1" },
        workListSchema,
      ),
      this.genresFor(type),
    ]);
    return mapWorkList(type, list, genres);
  }

  async listPopularWorks(language: StudyLanguage): Promise<WorkCandidate[]> {
    const lists = await Promise.all(
      MEDIA_TYPES.map(async (type) => {
        const [list, genres] = await Promise.all([
          this.client.get(
            `discover/${TMDB_KIND[type]}`,
            { ...POPULAR_FILTERS, with_original_language: TMDB_LANGUAGE[language], language: PORTUGUESE },
            workListSchema,
          ),
          this.genresFor(type),
        ]);
        return mapWorkList(type, list, genres);
      }),
    );
    return lists.flat();
  }

  async discoverWorks(query: DiscoverQuery): Promise<WorkPage> {
    const page = Math.min(Math.max(1, Math.trunc(query.page)), MAX_DISCOVER_PAGE);
    const [list, genres] = await Promise.all([
      this.client.get(
        `discover/${TMDB_KIND[query.type]}`,
        {
          ...DISCOVER_SORT[query.sort],
          include_adult: "false",
          page: String(page),
          language: PORTUGUESE,
          ...(query.language ? { with_original_language: TMDB_LANGUAGE[query.language] } : {}),
        },
        workListSchema,
      ),
      this.genresFor(query.type),
    ]);
    return {
      works: mapWorkList(query.type, list, genres),
      page,
      totalPages: Math.min(list.total_pages ?? 1, MAX_DISCOVER_PAGE),
    };
  }

  async searchWorks(query: string): Promise<WorkSummary[]> {
    const params = { query, include_adult: "false", page: "1" };
    const localized = await this.client.get(
      "search/multi",
      { ...params, language: PORTUGUESE },
      searchMultiSchema,
    );
    const mapped = mapSearchResults(localized);
    if (!mapped.some(needsEnglishFallback)) return mapped;
    const english = await this.client.get(
      "search/multi",
      { ...params, language: ENGLISH },
      searchMultiSchema,
    );
    return mapSearchResults(localized, english);
  }

  async getWork(type: MediaType, externalId: string): Promise<WorkDetails> {
    const id = tmdbNumericId(type, externalId);
    if (!id) throw new AppError("METADATA_NOT_FOUND");
    if (type === "movie") {
      const path = `movie/${id}`;
      const localized = await this.client.get(path, { language: PORTUGUESE }, movieDetailsSchema);
      const mapped = mapMovieDetails(localized);
      if (!needsEnglishFallback(mapped)) return mapped;
      return mapMovieDetails(
        localized,
        await this.client.get(path, { language: ENGLISH }, movieDetailsSchema),
      );
    }
    const path = `tv/${id}`;
    const localized = await this.client.get(path, { language: PORTUGUESE }, tvDetailsSchema);
    const mapped = mapTvDetails(localized);
    if (!needsEnglishFallback(mapped)) return mapped;
    return mapTvDetails(localized, await this.client.get(path, { language: ENGLISH }, tvDetailsSchema));
  }

  async getSeasonEpisodes(externalId: string, seasonNumber: number): Promise<EpisodeMetadata[]> {
    const id = tmdbNumericId("series", externalId);
    if (!id || !Number.isInteger(seasonNumber) || seasonNumber < 0) {
      throw new AppError("METADATA_NOT_FOUND");
    }
    const path = `tv/${id}/season/${seasonNumber}`;
    const localized = await this.client.get(path, { language: PORTUGUESE }, seasonDetailsSchema);
    if (!seasonNeedsEnglishFallback(localized)) return mapSeasonEpisodes(localized);
    return mapSeasonEpisodes(
      localized,
      await this.client.get(path, { language: ENGLISH }, seasonDetailsSchema),
    );
  }
}
