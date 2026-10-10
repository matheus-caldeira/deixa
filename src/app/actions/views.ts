import type { EpisodeStatus, MediaType, PosterColors } from "@/modules/catalog";

export type SearchResultView = {
  externalId: string;
  type: MediaType;
  title: string;
  originalTitle: string;
  year: number | null;
  posterUrl: string | null;
  posterColors: PosterColors | null;
  inCatalog: boolean;
};

export type UploadEpisodeView = {
  id: string;
  episodeNumber: number;
  title: string;
  status: EpisodeStatus;
  hasPortuguese: boolean;
};

export type UploadTargetView = {
  mediaId: string;
  title: string;
  originalTitle: string;
  type: MediaType;
  year: number | null;
  overview: string;
  posterUrl: string | null;
  posterColors: PosterColors;
  manual: boolean;
  seasons: { seasonNumber: number; title: string; episodeCount: number | null }[];
  movieEpisode: UploadEpisodeView | null;
};

export type ImportView = {
  outcome: "PROCESSED" | "DUPLICATE";
  steps: { label: string; detail: string }[];
  hasPortuguese: boolean;
  episodeId: string;
  mediaId: string;
  seasonNumber: number;
  filename: string;
};
