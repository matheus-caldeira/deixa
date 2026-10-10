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
  posterColors?: PosterColors;
};

export type SeasonSummary = { seasonNumber: number; title: string; episodeCount: number | null };

export type WorkDetails = WorkSummary & {
  seasons: SeasonSummary[];
  runtimeMinutes: number | null;
  levelRange?: readonly [CefrLevel, CefrLevel];
  accent?: string;
};

export type EpisodeMetadata = {
  episodeNumber: number;
  title: string;
  overview: string;
  runtimeMinutes: number | null;
};

export interface MetadataProvider {
  readonly name: MetadataProviderName;
  searchWorks(query: string): Promise<WorkSummary[]>;
  getWork(type: MediaType, externalId: string): Promise<WorkDetails>;
  getSeasonEpisodes(externalId: string, seasonNumber: number): Promise<EpisodeMetadata[]>;
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
  posterColors: PosterColors;
  levelMin: CefrLevel;
  levelMax: CefrLevel;
  accent: string | null;
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
};

export type CatalogEntry = { media: MediaItem; readyEpisodes: number };
export type EpisodeWithSeason = Episode & { seasonNumber: number };

export interface CatalogRepository {
  findMediaById(id: string): Promise<MediaItem | null>;
  findMediaByExternal(provider: MetadataSource, externalId: string): Promise<MediaItem | null>;
  upsertMedia(input: MediaUpsert): Promise<string>;
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
