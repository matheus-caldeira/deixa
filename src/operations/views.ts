import type { ProcessingStep } from "@/modules/subtitles";
import type { EpisodeStatus, MediaType, PosterColors } from "@/modules/catalog";
import type { DisplayMode } from "@/shared/levels";
import type { LanguagePair, StudyLanguage } from "@/shared/study-languages";

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
  subtitleLanguages: StudyLanguage[];
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
  steps: ProcessingStep[];
  hasNative: boolean;
  episodeId: string;
  mediaId: string;
  seasonNumber: number;
  filename: string;
};

export type SubtitleOptionView = {
  fileId: string;
  language: StudyLanguage;
  release: string;
  downloads: number;
  hearingImpaired: boolean;
  machineTranslated: boolean;
  uploader: string | null;
};

export type SubtitleSearchView = {
  provider: "opensubtitles" | "fake";
  pair: LanguagePair;
  target: SubtitleOptionView[];
  native: SubtitleOptionView[];
  suggestion: { targetFileId: string | null; nativeFileId: string | null; sameRelease: boolean };
  existing: {
    target: string | null;
    native: string | null;
    hasTarget: boolean;
    hasNative: boolean;
  };
  quota: { remaining: number; resetAt: string | null } | null;
  cached: boolean;
};

export type SourceImportView = ImportView & {
  downloadsUsed: number;
  quota: { remaining: number; resetAt: string | null } | null;
};

export type LyricsCandidateView = {
  id: string;
  artist: string;
  title: string;
  album: string | null;
  durationMs: number | null;
  synced: boolean;
  instrumental: boolean;
};

export type PlaylistTileView = {
  id: string;
  title: string;
  songCount: number;
  owned: boolean;
  creatorName: string | null;
  href: string;
};

export type MusicHomeView = {
  defaultPlaylistId: string;
  playlists: PlaylistTileView[];
  lyricsProvider: "lrclib" | "fake";
};

export type SongRowView = {
  episodeId: string;
  number: number;
  artist: string;
  title: string;
  youtubeVideoId: string;
  thumbnailUrl: string;
  status: EpisodeStatus;
  cueCount: number;
  durationMs: number | null;
  hasTranslation: boolean;
  translationSource: "llm" | "manual" | "none";
  listenHref: string;
  readHref: string | null;
};

export type PlaylistPageView = {
  id: string;
  title: string;
  canEdit: boolean;
  backHref: string;
  songs: SongRowView[];
  pair: LanguagePair;
  lyricsProvider: "lrclib" | "fake";
};

export type ListenPageView = {
  episodeId: string;
  playlistId: string;
  playlistTitle: string;
  backHref: string;
  readHref: string;
  canEdit: boolean;
  youtubeVideoId: string;
  artist: string;
  title: string;
  durationMs: number | null;
  timing: { leadInMs: number; pauses: { atMs: number; durationMs: number }[] };
  translationSource: "llm" | "manual" | "none";
  hasNative: boolean;
  pair: LanguagePair;
  defaultMode: DisplayMode;
  cues: { cueId: string; startMs: number; endMs: number; text: string; translation: string | null }[];
};
