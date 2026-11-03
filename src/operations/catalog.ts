import { z } from "zod";
import type { Container } from "@/infrastructure/container";
import { voiceFor } from "@/modules/audio";
import {
  episodeLabel,
  posterUrl,
  type Episode,
  type EpisodeContext,
  type MediaItem,
  type Season,
} from "@/modules/catalog";
import { pairOf, type Preferences } from "@/modules/identity";
import type { ProcessingStep } from "@/modules/subtitles";
import { AppError } from "@/shared/errors";
import type { StudyLanguage } from "@/shared/study-languages";
import { operation, type ScheduleJob, type Upload } from "./operation";
import type {
  ImportView,
  SearchResultView,
  SourceImportView,
  SubtitleOptionView,
  SubtitleSearchView,
  UploadEpisodeView,
  UploadTargetView,
} from "./views";

export const MAX_UPLOAD_BYTES = 5_000_000;
const MAX_UPLOAD_MB = 5;
export const MAX_SCRIPT_UPLOAD_BYTES = 2_000_000;
const MAX_SCRIPT_UPLOAD_MB = 2;
const MAX_OPTIONS = 8;
const MAX_RELEASE_CHARS = 120;
const MAX_UPLOADER_CHARS = 40;
const MAX_FILENAME_CHARS = 255;

const mediaTypeSchema = z.enum(["series", "movie"]);
const idSchema = z.uuid();
const uploadSchema = z.object({
  filename: z.string().max(MAX_FILENAME_CHARS),
  bytes: z.instanceof(Uint8Array),
});
const tmdbWorkSchema = z.object({ type: mediaTypeSchema, externalId: z.string().regex(/^(tv|movie):\d+$/) });

export const uploadSubtitlesSchema = z.object({
  mediaId: idSchema,
  episodeId: idSchema,
  useSample: z.boolean().default(false),
  target: uploadSchema.optional(),
  native: uploadSchema.optional(),
  script: uploadSchema.optional(),
});

function checkSize(
  upload: Upload | undefined,
  limit: number,
  code: "SUBTITLE_INVALID" | "SCRIPT_INVALID",
  mb: number,
) {
  if (upload && upload.bytes.byteLength > limit)
    throw new AppError(code, { key: "tooLarge", params: { mb } });
  return upload && upload.bytes.byteLength > 0 ? upload : undefined;
}

function toEpisodeView(episode: Episode): UploadEpisodeView {
  return {
    id: episode.id,
    episodeNumber: episode.episodeNumber,
    title: episode.title,
    status: episode.status,
    subtitleLanguages: episode.subtitleLanguages,
  };
}

async function listAllSeasons(app: Container, mediaId: string, media: MediaItem): Promise<Season[]> {
  const known = await app.listSeasons(mediaId);
  return media.type === "movie" ? known.slice(0, 1) : known;
}

async function toTarget(app: Container, userId: string, media: MediaItem): Promise<UploadTargetView> {
  const seasons = await listAllSeasons(app, media.id, media);
  const movieSeason = media.type === "movie" ? seasons[0] : undefined;
  const movieEpisodes = movieSeason
    ? await app.loadSeasonEpisodes({ userId, mediaId: media.id, seasonNumber: movieSeason.seasonNumber })
    : null;
  return {
    mediaId: media.id,
    title: media.title,
    originalTitle: media.originalTitle,
    type: media.type,
    year: media.year,
    overview: media.overview,
    posterUrl: posterUrl(media.posterPath),
    posterColors: media.posterColors,
    seasons: seasons.map((season) => ({
      seasonNumber: season.seasonNumber,
      title: season.title,
      episodeCount: season.episodeCount,
    })),
    movieEpisode: movieEpisodes?.episodes[0] ? toEpisodeView(movieEpisodes.episodes[0]) : null,
  };
}

async function scheduleEpisodeAudio(
  app: Container,
  schedule: ScheduleJob,
  input: { userId: string; preferences: Preferences; episodeId: string; label: string },
): Promise<void> {
  if (!app.audioBatchAvailable) return;
  const language = input.preferences.targetLanguage;
  if (await app.hasPendingJob("episode_audio", { episodeId: input.episodeId, language })) return;
  await schedule("episode_audio", {
    userId: input.userId,
    episodeId: input.episodeId,
    language,
    voice: voiceFor(language, input.preferences.preferredAccent),
    episodeLabel: input.label,
  });
}

async function scheduleEpisodeLevel(
  app: Container,
  schedule: ScheduleJob,
  input: { context: EpisodeContext; language: StudyLanguage },
): Promise<void> {
  if (input.context.media.originalLanguage !== input.language) return;
  const payload = { episodeId: input.context.episode.id, language: input.language };
  if (await app.hasPendingJob("episode_level", payload)) return;
  await schedule("episode_level", payload);
}

function fullEpisodeLabel(context: EpisodeContext): string {
  return `${context.media.title} · ${episodeLabel(context.media.type, context.season.seasonNumber, context.episode.episodeNumber)}`;
}

const quotaView = (quota: { remaining: number; resetAt: Date | null } | null) =>
  quota ? { remaining: quota.remaining, resetAt: quota.resetAt?.toISOString() ?? null } : null;

function withSuggestion<Candidate extends { fileId: string }>(
  candidates: readonly Candidate[],
  suggested: Candidate | null,
): Candidate[] {
  const ordered = suggested
    ? [suggested, ...candidates.filter((candidate) => candidate.fileId !== suggested.fileId)]
    : [...candidates];
  return ordered.slice(0, MAX_OPTIONS);
}

export const catalogOperations = {
  "catalog.searchWorks": operation({
    input: z.unknown(),
    run: async ({ user, app }, query): Promise<SearchResultView[]> => {
      const parsed = z.string().max(100).safeParse(query);
      if (!parsed.success) return [];
      const results = await app.searchWorks(user.id, parsed.data);
      return results.map((work) => ({
        externalId: work.externalId,
        type: work.type,
        title: work.title,
        originalTitle: work.originalTitle,
        year: work.year,
        posterUrl: posterUrl(work.posterPath),
        posterColors: work.posterColors ?? null,
        inCatalog: work.catalogMediaId !== null,
      }));
    },
  }),
  "catalog.selectWork": operation({
    input: z.object({ type: mediaTypeSchema, externalId: z.string().min(1).max(60) }),
    refresh: true,
    run: async ({ user, app }, input) => {
      const { mediaId } = await app.registerWork({ userId: user.id, ...input });
      const media = await app.getMediaById(mediaId);
      if (!media) throw new AppError("MEDIA_NOT_FOUND");
      return toTarget(app, user.id, media);
    },
  }),
  "catalog.openUploadTarget": operation({
    input: z.unknown(),
    run: async ({ user, app }, mediaId) => {
      const parsed = idSchema.safeParse(mediaId);
      if (!parsed.success) throw new AppError("MEDIA_NOT_FOUND");
      const media = await app.getMediaById(parsed.data);
      if (!media) throw new AppError("MEDIA_NOT_FOUND");
      return toTarget(app, user.id, media);
    },
  }),
  "catalog.loadEpisodes": operation({
    input: z.object({ mediaId: idSchema, seasonNumber: z.number().int().min(0).max(999) }),
    run: async ({ user, app }, input) => {
      const { episodes } = await app.loadSeasonEpisodes({ userId: user.id, ...input });
      return episodes.map(toEpisodeView);
    },
  }),
  "catalog.uploadSubtitles": operation({
    input: uploadSubtitlesSchema,
    refresh: true,
    run: async ({ user, app, schedule, readSample }, input): Promise<ImportView> => {
      const episodeId = input.episodeId;
      const context = await app.getEpisodeContext(episodeId);
      if (!context || context.media.id !== input.mediaId) throw new AppError("EPISODE_NOT_FOUND");
      const pair = pairOf(user.preferences);
      const sample = input.useSample && app.devShortcuts;
      const target = sample
        ? ((await readSample(pair.target)) ?? undefined)
        : checkSize(input.target, MAX_UPLOAD_BYTES, "SUBTITLE_INVALID", MAX_UPLOAD_MB);
      const native = sample
        ? ((await readSample(pair.native)) ?? undefined)
        : checkSize(input.native, MAX_UPLOAD_BYTES, "SUBTITLE_INVALID", MAX_UPLOAD_MB);
      const script = checkSize(input.script, MAX_SCRIPT_UPLOAD_BYTES, "SCRIPT_INVALID", MAX_SCRIPT_UPLOAD_MB);
      const hasTargetSubtitle = context.episode.subtitleLanguages.includes(pair.target);
      if (!target && !(script && hasTargetSubtitle)) throw new AppError("SUBTITLE_INVALID", "targetRequired");
      const result = target
        ? await app.importEpisodeSubtitles({
            userId: user.id,
            episodeId,
            target: { language: pair.target, upload: target },
            native: native ? { language: pair.native, upload: native } : undefined,
          })
        : null;
      const scriptSteps: ProcessingStep[] = script
        ? (
            await app.importEpisodeScript({
              userId: user.id,
              episodeId,
              language: pair.target,
              upload: script,
            })
          ).steps
        : [];
      if (result) await scheduleEpisodeLevel(app, schedule, { context, language: pair.target });
      if (result?.outcome === "PROCESSED") {
        await scheduleEpisodeAudio(app, schedule, {
          userId: user.id,
          preferences: user.preferences,
          episodeId,
          label: fullEpisodeLabel(context),
        });
      }
      return {
        outcome: result?.outcome ?? "PROCESSED",
        steps: [...(result?.steps ?? []), ...scriptSteps],
        hasNative: result?.hasNative ?? context.episode.subtitleLanguages.includes(pair.native),
        episodeId,
        mediaId: context.media.id,
        seasonNumber: context.season.seasonNumber,
        filename: target?.filename ?? script?.filename ?? "",
      };
    },
  }),
  "catalog.searchSubtitles": operation({
    input: z.object({ episodeId: idSchema, refresh: z.boolean().default(false) }),
    run: async ({ user, app }, input): Promise<SubtitleSearchView> => {
      const [search, origins] = await Promise.all([
        app.searchSubtitles({ userId: user.id, ...input }),
        app.listSubtitleOrigins(input.episodeId),
      ]);
      const toOption = (candidate: (typeof search.ranking.target)[number]): SubtitleOptionView => ({
        fileId: candidate.fileId,
        language: candidate.language,
        release: candidate.release.slice(0, MAX_RELEASE_CHARS),
        downloads: candidate.downloads,
        hearingImpaired: candidate.hearingImpaired,
        machineTranslated: candidate.machineTranslated,
        uploader: candidate.uploader?.slice(0, MAX_UPLOADER_CHARS) ?? null,
      });
      const pair = pairOf(user.preferences);
      const target = origins.find((file) => file.language === pair.target);
      const native = origins.find((file) => file.language === pair.native);
      return {
        provider: search.provider,
        pair,
        target: withSuggestion(search.ranking.target, search.ranking.suggestion.target).map(toOption),
        native: withSuggestion(search.ranking.native, search.ranking.suggestion.native).map(toOption),
        suggestion: {
          targetFileId: search.ranking.suggestion.target?.fileId ?? null,
          nativeFileId: search.ranking.suggestion.native?.fileId ?? null,
          sameRelease: search.ranking.suggestion.sameRelease,
        },
        existing: {
          target: target?.origin?.externalFileId ?? null,
          native: native?.origin?.externalFileId ?? null,
          hasTarget: Boolean(target),
          hasNative: Boolean(native),
        },
        quota: quotaView(search.quota),
        cached: search.cached,
      };
    },
  }),
  "catalog.importFromSource": operation({
    input: z.object({
      mediaId: idSchema,
      episodeId: idSchema,
      targetFileId: z.string().min(1).max(40),
      nativeFileId: z.string().min(1).max(40).nullable(),
    }),
    refresh: true,
    run: async ({ user, app, schedule }, input): Promise<SourceImportView> => {
      const { mediaId, episodeId, targetFileId, nativeFileId } = input;
      const context = await app.getEpisodeContext(episodeId);
      if (!context || context.media.id !== mediaId) throw new AppError("EPISODE_NOT_FOUND");
      const result = await app.importFromSource({
        userId: user.id,
        episodeId,
        pair: pairOf(user.preferences),
        targetFileId,
        nativeFileId,
      });
      await scheduleEpisodeLevel(app, schedule, { context, language: pairOf(user.preferences).target });
      if (result.outcome === "PROCESSED") {
        await scheduleEpisodeAudio(app, schedule, {
          userId: user.id,
          preferences: user.preferences,
          episodeId,
          label: fullEpisodeLabel(context),
        });
      }
      return {
        outcome: result.outcome,
        steps: [
          {
            key: "download",
            detail:
              result.downloadsUsed === 0
                ? { key: "alreadyInCatalog" }
                : { key: "downloads", params: { count: result.downloadsUsed } },
          },
          ...result.steps,
        ],
        hasNative: result.hasNative,
        episodeId,
        mediaId,
        seasonNumber: context.season.seasonNumber,
        filename: "OpenSubtitles",
        downloadsUsed: result.downloadsUsed,
        quota: quotaView(result.quota),
      };
    },
  }),
  "catalog.refreshWork": operation({
    input: z.unknown(),
    refresh: true,
    run: async ({ user, app }, mediaId) => {
      const parsed = idSchema.safeParse(mediaId);
      if (!parsed.success) throw new AppError("MEDIA_NOT_FOUND");
      return app.refreshWork({ userId: user.id, mediaId: parsed.data, force: true });
    },
  }),
  "catalog.studyEpisode": operation({
    input: z.unknown(),
    refresh: true,
    run: async ({ user, app }, episodeId) => {
      const parsed = idSchema.safeParse(episodeId);
      if (!parsed.success) throw new AppError("EPISODE_NOT_FOUND");
      await app.startEpisode(user.id, parsed.data);
      await app.updatePreferences(user.id, { currentEpisodeId: parsed.data });
      return null;
    },
  }),
  "catalog.openTmdbWork": operation({
    input: tmdbWorkSchema,
    refresh: true,
    run: async ({ user, app }, input) => {
      const { mediaId } = await app.registerWork({ userId: user.id, ...input });
      return { mediaId };
    },
  }),
  "catalog.rateWorkLevel": operation({
    input: tmdbWorkSchema,
    refresh: true,
    run: async ({ user, app }, input) => {
      const rated = await app.rateWorkLevel({ actor: { userId: user.id, isAdmin: user.isAdmin }, ...input });
      const [min, max] = rated.range ?? rated.ai.range;
      return { range: `${min}–${max}`, reason: rated.ai.reason, ratings: rated.ratings.length };
    },
  }),
};
