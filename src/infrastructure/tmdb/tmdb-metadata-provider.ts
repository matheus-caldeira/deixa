import type {
  EpisodeMetadata,
  MediaType,
  MetadataProvider,
  WorkDetails,
  WorkSummary,
} from "@/modules/catalog";
import type { TmdbClient } from "./client";
import {
  mapMovieDetails,
  mapSearchResults,
  mapSeasonEpisodes,
  mapTvDetails,
  needsEnglishFallback,
  seasonNeedsEnglishFallback,
} from "./mapping";
import { movieDetailsSchema, searchMultiSchema, seasonDetailsSchema, tvDetailsSchema } from "./schemas";

const PORTUGUESE = "pt-BR";
const ENGLISH = "en-US";

export class TmdbMetadataProvider implements MetadataProvider {
  readonly name = "tmdb" as const;

  constructor(private readonly client: TmdbClient) {}

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
    if (type === "movie") {
      const path = `movie/${encodeURIComponent(externalId)}`;
      const localized = await this.client.get(path, { language: PORTUGUESE }, movieDetailsSchema);
      const mapped = mapMovieDetails(localized);
      if (!needsEnglishFallback(mapped)) return mapped;
      return mapMovieDetails(
        localized,
        await this.client.get(path, { language: ENGLISH }, movieDetailsSchema),
      );
    }
    const path = `tv/${encodeURIComponent(externalId)}`;
    const localized = await this.client.get(path, { language: PORTUGUESE }, tvDetailsSchema);
    const mapped = mapTvDetails(localized);
    if (!needsEnglishFallback(mapped)) return mapped;
    return mapTvDetails(localized, await this.client.get(path, { language: ENGLISH }, tvDetailsSchema));
  }

  async getSeasonEpisodes(externalId: string, seasonNumber: number): Promise<EpisodeMetadata[]> {
    const path = `tv/${encodeURIComponent(externalId)}/season/${seasonNumber}`;
    const localized = await this.client.get(path, { language: PORTUGUESE }, seasonDetailsSchema);
    if (!seasonNeedsEnglishFallback(localized)) return mapSeasonEpisodes(localized);
    return mapSeasonEpisodes(
      localized,
      await this.client.get(path, { language: ENGLISH }, seasonDetailsSchema),
    );
  }
}
