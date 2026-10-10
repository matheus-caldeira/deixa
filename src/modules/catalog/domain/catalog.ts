import type { CefrLevel } from "@/shared/levels";
import { MS_PER_DAY } from "@/shared/time";

export type MediaType = "series" | "movie";
export type MetadataProviderName = "tmdb" | "fake";
export type MetadataSource = MetadataProviderName | "manual";
export type EpisodeStatus = "NONE" | "UPLOADED" | "PROCESSING" | "READY" | "FAILED" | "NEEDS_REVIEW";
export type PosterColors = { c1: string; c2: string; fg: string };

export const MOVIE_SEASON_NUMBER = 0;
export const MOVIE_EPISODE_NUMBER = 1;
export const MOVIE_EPISODE_TITLE = "Filme completo";
export const DEFAULT_LEVEL_RANGE: readonly [CefrLevel, CefrLevel] = ["B1", "B2"];
export const METADATA_MAX_AGE_DAYS = 7;
export const TMDB_POSTER_BASE_URL = "https://image.tmdb.org/t/p/w342";

export type MediaItem = {
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
  uploaderName: string | null;
  metadataSyncedAt: Date | null;
};

export type Season = {
  id: string;
  mediaItemId: string;
  seasonNumber: number;
  title: string;
  episodeCount: number | null;
  episodesSyncedAt: Date | null;
};

export type Episode = {
  id: string;
  seasonId: string;
  episodeNumber: number;
  title: string;
  overview: string;
  durationSeconds: number | null;
  status: EpisodeStatus;
  failureReason: string | null;
  cueCount: number;
  alignmentPairs: number | null;
  alignmentRate: number | null;
  hasPortuguese: boolean;
};

export type EpisodeContext = { episode: Episode; season: Season; media: MediaItem };

const POSTER_PALETTE: readonly PosterColors[] = [
  { c1: "#7B3FE4", c2: "#F3B61F", fg: "#fff" },
  { c1: "#13305C", c2: "#E8A33D", fg: "#fff" },
  { c1: "#E9E4D8", c2: "#5A6B7D", fg: "#1D2430" },
  { c1: "#0B5D3B", c2: "#F2D16B", fg: "#fff" },
  { c1: "#1E3B1A", c2: "#C9D86B", fg: "#fff" },
  { c1: "#B31B34", c2: "#111", fg: "#fff" },
  { c1: "#0D1B2A", c2: "#4C8BF5", fg: "#fff" },
  { c1: "#3BA3D9", c2: "#F7E26B", fg: "#fff" },
  { c1: "#1A2A4F", c2: "#F2C94C", fg: "#fff" },
  { c1: "#20262E", c2: "#C7A76C", fg: "#fff" },
];

export function posterColorsFor(title: string): PosterColors {
  const sum = [...title].reduce((total, char) => total + char.charCodeAt(0), 0);
  return POSTER_PALETTE[sum % POSTER_PALETTE.length] ?? { c1: "#13305C", c2: "#E8A33D", fg: "#fff" };
}

export function isMetadataStale(syncedAt: Date | null, now: Date): boolean {
  if (!syncedAt) return true;
  return now.getTime() - syncedAt.getTime() > METADATA_MAX_AGE_DAYS * MS_PER_DAY;
}

export function episodeLabel(type: MediaType, seasonNumber: number, episodeNumber: number): string {
  return type === "movie" ? "Filme" : `T${seasonNumber} · E${episodeNumber}`;
}

export function posterUrl(posterPath: string | null): string | null {
  return posterPath ? `${TMDB_POSTER_BASE_URL}${posterPath}` : null;
}
