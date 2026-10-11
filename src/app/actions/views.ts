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

export type SubtitleOptionView = {
  fileId: string;
  language: "en" | "pt-BR";
  release: string;
  downloads: number;
  hearingImpaired: boolean;
  machineTranslated: boolean;
  uploader: string | null;
};

export type SubtitleSearchView = {
  provider: "opensubtitles" | "fake";
  english: SubtitleOptionView[];
  portuguese: SubtitleOptionView[];
  suggestion: { englishFileId: string | null; portugueseFileId: string | null; sameRelease: boolean };
  existing: {
    english: string | null;
    portuguese: string | null;
    hasEnglish: boolean;
    hasPortuguese: boolean;
  };
  quota: { remaining: number; resetAt: string | null } | null;
  cached: boolean;
};

export type SourceImportView = ImportView & {
  downloadsUsed: number;
  quota: { remaining: number; resetAt: string | null } | null;
};
