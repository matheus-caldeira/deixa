import { z } from "zod";
import { studyLanguageSchema } from "@/shared/study-languages";

export const PACKAGE_FORMAT_VERSION = 1;
export const PACKAGE_EXTENSION = ".deixa.zip";
export const MANIFEST_PATH = "manifest.json";
export const CATALOG_PATH = "catalog.json";
export const CARDS_DIR = "cards";
export const SUBTITLES_DIR = "subtitles";
export const AUDIO_DIR = "audio";
export const AUDIO_INDEX_PATH = "audio/index.json";
export const PERSONAL_PATH = "personal.enc";

export const MAX_PACKAGE_BYTES = 1_000_000_000;
export const MAX_PACKAGE_FILES = 20_000;
export const MAX_JSON_BYTES = 20_000_000;
export const MAX_SUBTITLE_BYTES = 5_000_000;

const ID = z.string().min(1).max(200);
const SHA256 = z.string().regex(/^[0-9a-f]{64}$/);
const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
const MAX_TEXT = 4000;
const MAX_SHORT = 300;

export const packageEntrySchema = z.object({
  path: z.string().regex(SAFE_PATH).max(300),
  sha256: SHA256,
  bytes: z.number().int().min(0).max(MAX_PACKAGE_BYTES),
});

export const manifestSchema = z.object({
  format: z.literal("deixa-package"),
  version: z.number().int().min(1),
  generatedAt: z.string().datetime(),
  app: z.object({ name: z.string().max(MAX_SHORT), version: z.string().max(MAX_SHORT) }),
  entries: z.array(packageEntrySchema).max(MAX_PACKAGE_FILES),
});
export type Manifest = z.infer<typeof manifestSchema>;

export const episodeRefSchema = z.object({
  workKey: ID,
  seasonNumber: z.number().int().min(0),
  episodeNumber: z.number().int().min(0),
});
export type EpisodeRef = z.infer<typeof episodeRefSchema>;

export const packagedSongSchema = z.object({
  youtubeVideoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  artist: z.string().max(MAX_SHORT),
  trackTitle: z.string().max(MAX_SHORT),
  durationMs: z.number().int().min(0).nullable(),
  leadInMs: z.number().int().min(0).max(600_000),
  pauses: z
    .array(
      z.object({
        atMs: z.number().int().min(0),
        durationMs: z.number().int().min(1).max(600_000),
      }),
    )
    .max(20),
  lyricsSource: z.enum(["lrclib", "fake", "manual"]),
  lyricsExternalId: z.string().max(MAX_SHORT).nullable(),
  translationSource: z.enum(["llm", "manual", "none"]),
});
export type PackagedSong = z.infer<typeof packagedSongSchema>;

export const packagedEpisodeSchema = z.object({
  seasonNumber: z.number().int().min(0),
  episodeNumber: z.number().int().min(0),
  title: z.string().max(MAX_SHORT),
  overview: z.string().max(MAX_TEXT),
  durationSeconds: z.number().int().min(0).nullable(),
  stillPath: z.string().max(MAX_SHORT).nullable(),
  subtitles: z.array(
    z.object({
      language: studyLanguageSchema,
      path: z.string().regex(SAFE_PATH),
      sha256: SHA256,
      originalFilename: z.string().max(MAX_SHORT),
    }),
  ),
  cardsPath: z.string().regex(SAFE_PATH).nullable(),
  song: packagedSongSchema.optional(),
});
export type PackagedEpisode = z.infer<typeof packagedEpisodeSchema>;

export const packagedSeasonSchema = z.object({
  seasonNumber: z.number().int().min(0),
  title: z.string().max(MAX_SHORT),
  episodeCount: z.number().int().min(0).nullable(),
});

export const packagedWorkSchema = z.object({
  workKey: ID,
  metadataProvider: z.enum(["tmdb", "fake", "manual"]),
  externalId: z.string().max(MAX_SHORT),
  type: z.enum(["series", "movie", "music"]),
  title: z.string().max(MAX_SHORT),
  originalTitle: z.string().max(MAX_SHORT),
  overview: z.string().max(MAX_TEXT),
  year: z.number().int().nullable(),
  posterPath: z.string().max(MAX_SHORT).nullable(),
  backdropPath: z.string().max(MAX_SHORT).nullable(),
  posterColors: z.object({ c1: z.string().max(20), c2: z.string().max(20), fg: z.string().max(20) }),
  levelMin: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  levelMax: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  accent: z.string().max(MAX_SHORT).nullable(),
  seasons: z.array(packagedSeasonSchema).max(200),
  episodes: z.array(packagedEpisodeSchema).max(5000),
});
export type PackagedWork = z.infer<typeof packagedWorkSchema>;

export const packagedCatalogSchema = z.object({ works: z.array(packagedWorkSchema).max(500) });
export type PackagedCatalog = z.infer<typeof packagedCatalogSchema>;

export const packagedCardSchema = z.object({
  language: studyLanguageSchema.default("en"),
  locale: studyLanguageSchema.default("pt-BR"),
  cueSequence: z.number().int().min(1),
  startToken: z.number().int().min(0),
  endToken: z.number().int().min(0),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  kind: z.enum(["word", "phrase", "line"]),
  term: z.string().max(MAX_SHORT),
  itemType: z.enum(["word", "expression", "phrasal_verb", "slang", "sentence"]),
  difficulty: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  meaning: z.string().max(MAX_TEXT),
  meaningSource: z.enum(["subtitle_pt", "llm"]),
  pronunciation: z.string().max(MAX_SHORT).nullable(),
  exampleEnglish: z.string().max(MAX_TEXT).nullable(),
  examplePortuguese: z.string().max(MAX_TEXT).nullable(),
  lineText: z.string().max(MAX_TEXT),
  lineTranslation: z.string().max(MAX_TEXT).nullable(),
  lineTranslationSource: z.enum(["subtitle_pt", "llm"]).nullable(),
});
export type PackagedCard = z.infer<typeof packagedCardSchema>;
export const packagedCardsSchema = z.object({ cards: z.array(packagedCardSchema).max(5000) });

export const packagedAudioSchema = z.object({
  path: z.string().regex(SAFE_PATH),
  textHash: SHA256,
  voiceId: z.string().max(MAX_SHORT),
  language: z.string().max(20),
  modelVersion: z.string().max(MAX_SHORT),
  format: z.string().max(20),
});
export type PackagedAudio = z.infer<typeof packagedAudioSchema>;
export const packagedAudioIndexSchema = z.object({
  assets: z.array(packagedAudioSchema).max(MAX_PACKAGE_FILES),
});

export const workKeyOf = (metadataProvider: string, externalId: string): string =>
  `${metadataProvider}:${externalId}`;

export const episodeDir = (ref: EpisodeRef): string =>
  `${ref.workKey.replace(/[^A-Za-z0-9._-]/g, "_")}/s${ref.seasonNumber}e${ref.episodeNumber}`;

export type ExportScope =
  | { kind: "work"; mediaId: string }
  | { kind: "season"; mediaId: string; seasonNumber: number }
  | { kind: "episode"; mediaId: string; episodeId: string };

export type ExportOptions = { subtitles: boolean; cards: boolean; audio: boolean };

export const exportRequestSchema = z.object({
  scope: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("work"), mediaId: z.uuid() }),
    z.object({ kind: z.literal("season"), mediaId: z.uuid(), seasonNumber: z.number().int().min(0) }),
    z.object({ kind: z.literal("episode"), mediaId: z.uuid(), episodeId: z.uuid() }),
  ]),
  options: z.object({ subtitles: z.boolean(), cards: z.boolean(), audio: z.boolean() }),
});
