import type { StudyLanguage } from "@/shared/study-languages";
import type { CefrLevel } from "@/shared/levels";
import type {
  Episode,
  EpisodeContext,
  MediaItem,
  MediaType,
  MetadataProviderName,
  MetadataSource,
  PosterColors,
  Season,
} from "../domain/catalog";

export type WorkSummary = {
  provider: MetadataProviderName;
  externalId: string;
  type: MediaType;
  title: string;
  originalTitle: string;
  overview: string;
  year: number | null;
  posterPath: string | null;
  backdropPath?: string | null;
  posterColors?: PosterColors;
  originalLanguage?: string | null;
  levelRange?: readonly [CefrLevel, CefrLevel];
};

export type WorkCandidate = WorkSummary & {
  genres: string[];
  originalLanguage: string | null;
  popularity: number;
  voteAverage?: number | null;
  voteCount?: number | null;
};

export const DISCOVER_SORTS = ["popular", "votes", "rating"] as const;
export type DiscoverSort = (typeof DISCOVER_SORTS)[number];
export type DiscoverQuery = {
  type: MediaType;
  language: StudyLanguage | null;
  sort: DiscoverSort;
  page: number;
};
export type WorkPage = { works: WorkCandidate[]; page: number; totalPages: number };

export type SeasonSummary = { seasonNumber: number; title: string; episodeCount: number | null };

export type WorkDetails = WorkSummary & {
  seasons: SeasonSummary[];
  runtimeMinutes: number | null;
  accent?: string;
};

export type EpisodeMetadata = {
  episodeNumber: number;
  title: string;
  overview: string;
  runtimeMinutes: number | null;
  stillPath?: string | null;
};

export interface MetadataProvider {
  readonly name: MetadataProviderName;
  searchWorks(query: string): Promise<WorkSummary[]>;
  getWork(type: MediaType, externalId: string): Promise<WorkDetails>;
  getSeasonEpisodes(externalId: string, seasonNumber: number): Promise<EpisodeMetadata[]>;
  listRelatedWorks(type: MediaType, externalId: string): Promise<WorkCandidate[]>;
  listPopularWorks(language: StudyLanguage): Promise<WorkCandidate[]>;
  discoverWorks(query: DiscoverQuery): Promise<WorkPage>;
}

export type MediaUpsert = {
  id: string;
  type: MediaType;
  title: string;
  originalTitle: string;
  overview: string;
  year: number | null;
  metadataProvider: MetadataSource;
  externalId: string;
  posterPath: string | null;
  backdropPath: string | null;
  posterColors: PosterColors;
  levelMin: CefrLevel;
  levelMax: CefrLevel;
  accent: string | null;
  originalLanguage: StudyLanguage;
  createdBy: string | null;
  syncedAt: Date | null;
  createdAt: Date;
};

export type SeasonUpsert = { id: string; seasonNumber: number; title: string; episodeCount: number | null };
export type EpisodeUpsert = {
  id: string;
  episodeNumber: number;
  title: string;
  overview: string;
  durationSeconds: number | null;
  stillPath: string | null;
};

export type CatalogEntry = { media: MediaItem; readyEpisodes: number };
export type EpisodeWithSeason = Episode & { seasonNumber: number };

export interface CatalogRepository {
  findMediaById(id: string): Promise<MediaItem | null>;
  findMediaByExternal(provider: MetadataSource, externalId: string): Promise<MediaItem | null>;
  upsertMedia(input: MediaUpsert): Promise<string>;
  updateLevelRange(mediaId: string, range: readonly [CefrLevel, CefrLevel]): Promise<void>;
  upsertSeasons(mediaItemId: string, seasons: SeasonUpsert[]): Promise<void>;
  listSeasons(mediaItemId: string): Promise<Season[]>;
  upsertEpisodes(seasonId: string, episodes: EpisodeUpsert[], syncedAt: Date | null): Promise<void>;
  listEpisodes(seasonId: string): Promise<Episode[]>;
  listEpisodesByMedia(mediaItemId: string): Promise<EpisodeWithSeason[]>;
  listCatalog(): Promise<CatalogEntry[]>;
  findEpisodeContext(episodeId: string): Promise<EpisodeContext | null>;
}

export type EpisodeProgressEntry = { episodeId: string; progressPercent: number };

export interface EpisodeProgressRepository {
  listForUser(userId: string): Promise<EpisodeProgressEntry[]>;
  upsert(userId: string, episodeId: string, progressPercent: number, now: Date): Promise<void>;
}
