import type { PackagedCard } from "../domain/package";

export type PackageFile = { path: string; bytes: Uint8Array };

export interface PackageArchive {
  pack(files: PackageFile[]): Promise<Uint8Array>;
  unpack(bytes: Uint8Array): Promise<PackageFile[]>;
}

export type ExportableWork = {
  id: string;
  metadataProvider: "tmdb" | "fake" | "manual";
  externalId: string;
  type: "series" | "movie";
  title: string;
  originalTitle: string;
  overview: string;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  posterColors: { c1: string; c2: string; fg: string };
  levelMin: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  levelMax: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  accent: string | null;
};

export type ExportableSeason = {
  id: string;
  seasonNumber: number;
  title: string;
  episodeCount: number | null;
};

export type ExportableEpisode = {
  id: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  overview: string;
  durationSeconds: number | null;
  stillPath: string | null;
  ready: boolean;
};

export type ExportableSubtitle = {
  language: "en" | "pt-BR";
  sha256: string;
  storagePath: string;
  originalFilename: string;
};

export type ExportableAudio = {
  textHash: string;
  voiceId: string;
  language: string;
  modelVersion: string;
  format: string;
  storagePath: string;
};

export type CueRef = { id: string; sequence: number; text: string };

export type LocalWork = { mediaId: string; title: string; readyEpisodes: Set<string> };

export interface PackageCatalogReader {
  findWork(mediaId: string): Promise<ExportableWork | null>;
  findWorkByExternal(metadataProvider: string, externalId: string): Promise<LocalWork | null>;
  listSeasons(mediaId: string): Promise<ExportableSeason[]>;
  listEpisodes(mediaId: string): Promise<ExportableEpisode[]>;
  listSubtitles(episodeId: string): Promise<ExportableSubtitle[]>;
  listEnglishCues(episodeId: string): Promise<CueRef[]>;
  listCatalogCards(episodeId: string): Promise<(PackagedCard & { cueId: string })[]>;
  listAudioForTexts(texts: string[]): Promise<ExportableAudio[]>;
}

export type ImportedWorkTarget = { mediaId: string; episodeIds: Map<string, string> };

export interface PackageCatalogWriter {
  ensureWork(work: {
    metadataProvider: "tmdb" | "fake" | "manual";
    externalId: string;
    type: "series" | "movie";
    title: string;
    originalTitle: string;
    overview: string;
    year: number | null;
    posterPath: string | null;
    backdropPath: string | null;
    posterColors: { c1: string; c2: string; fg: string };
    levelMin: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
    levelMax: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
    accent: string | null;
    seasons: { seasonNumber: number; title: string; episodeCount: number | null }[];
    episodes: {
      seasonNumber: number;
      episodeNumber: number;
      title: string;
      overview: string;
      durationSeconds: number | null;
      stillPath: string | null;
    }[];
    createdBy: string;
    now: Date;
  }): Promise<{ mediaId: string; created: boolean; episodeIds: Map<string, string> }>;
  importSubtitles(input: {
    userId: string;
    episodeId: string;
    english: { filename: string; bytes: Uint8Array };
    portuguese: { filename: string; bytes: Uint8Array } | null;
  }): Promise<"PROCESSED" | "DUPLICATE">;
  createCatalogCard(input: {
    id: string;
    episodeId: string;
    cueId: string;
    card: PackagedCard;
    now: Date;
  }): Promise<void>;
  saveAudio(asset: ExportableAudio & { id: string }, now: Date): Promise<void>;
}

export const episodeKey = (seasonNumber: number, episodeNumber: number): string =>
  `s${seasonNumber}e${episodeNumber}`;

export interface PersonalCipher {
  seal(plain: Uint8Array, email: string, password: string): Promise<Uint8Array>;
  open(sealed: Uint8Array, email: string, password: string): Promise<Uint8Array | null>;
}

export type PersonalWorkRef = { metadataProvider: "tmdb" | "fake" | "manual"; externalId: string };

export interface PersonalDataReader {
  collect(userId: string, includeCredentials: boolean): Promise<import("../domain/personal").PersonalData>;
  listReferencedWorks(userId: string): Promise<(PersonalWorkRef & { mediaId: string })[]>;
}

export type PersonalMergeReport = {
  highlights: number;
  cards: number;
  reviews: number;
  progress: number;
  xp: number;
  credentials: number;
  skipped: number;
};

export interface PersonalDataWriter {
  merge(
    userId: string,
    data: import("../domain/personal").PersonalData,
    now: Date,
  ): Promise<PersonalMergeReport>;
}

export interface AccountGate {
  emailOf(userId: string): Promise<string | null>;
  verifyPassword(userId: string, password: string): Promise<boolean>;
}
