"use server";

import { readFile } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { z } from "zod";
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
import type { StudyLanguage } from "@/shared/study-languages";
import { AppError } from "@/shared/errors";
import { scheduleJob } from "../schedule";
import { requireUser } from "../session";
import { app, runAction, type ActionResult } from "./result";
import type {
  ImportView,
  SearchResultView,
  SourceImportView,
  SubtitleOptionView,
  SubtitleSearchView,
  UploadEpisodeView,
  UploadTargetView,
} from "./views";

const SAMPLES_DIR = "fixtures";
const MAX_UPLOAD_BYTES = 5_000_000;
const MAX_UPLOAD_MB = 5;
const MAX_SCRIPT_UPLOAD_BYTES = 2_000_000;
const MAX_SCRIPT_UPLOAD_MB = 2;
const MAX_OPTIONS = 8;
const MAX_RELEASE_CHARS = 120;
const MAX_UPLOADER_CHARS = 40;

const mediaTypeSchema = z.enum(["series", "movie"]);
const idSchema = z.uuid();

function toEpisodeView(episode: Episode): UploadEpisodeView {
  return {
    id: episode.id,
    episodeNumber: episode.episodeNumber,
    title: episode.title,
    status: episode.status,
    subtitleLanguages: episode.subtitleLanguages,
  };
}

async function toTarget(userId: string, media: MediaItem, seasons: Season[]): Promise<UploadTargetView> {
  const movieSeason = media.type === "movie" ? seasons[0] : undefined;
  const movieEpisodes = movieSeason
    ? await app().loadSeasonEpisodes({
        userId,
        mediaId: media.id,
        seasonNumber: movieSeason.seasonNumber,
      })
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

export async function searchWorksAction(query: unknown): Promise<ActionResult<SearchResultView[]>> {
  const user = await requireUser();
  return runAction("searchWorks", async () => {
    const parsed = z.string().max(100).safeParse(query);
    if (!parsed.success) return [];
    const results = await app().searchWorks(user.id, parsed.data);
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
  });
}

export async function selectWorkAction(input: unknown): Promise<ActionResult<UploadTargetView>> {
  const user = await requireUser();
  return runAction("selectWork", async () => {
    const parsed = z
      .object({ type: mediaTypeSchema, externalId: z.string().min(1).max(60) })
      .safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const { mediaId } = await app().registerWork({ userId: user.id, ...parsed.data });
    const media = await app().getMediaById(mediaId);
    if (!media) throw new AppError("MEDIA_NOT_FOUND");
    revalidatePath("/catalog");
    return toTarget(user.id, media, await listAllSeasons(mediaId, media));
  });
}

async function listAllSeasons(mediaId: string, media: MediaItem): Promise<Season[]> {
  const known = await app().listSeasons(mediaId);
  return media.type === "movie" ? known.slice(0, 1) : known;
}

export async function openUploadTargetAction(mediaId: unknown): Promise<ActionResult<UploadTargetView>> {
  const user = await requireUser();
  return runAction("openUploadTarget", async () => {
    const parsed = idSchema.safeParse(mediaId);
    if (!parsed.success) throw new AppError("MEDIA_NOT_FOUND");
    const media = await app().getMediaById(parsed.data);
    if (!media) throw new AppError("MEDIA_NOT_FOUND");
    return toTarget(user.id, media, await listAllSeasons(parsed.data, media));
  });
}

export async function loadEpisodesAction(input: unknown): Promise<ActionResult<UploadEpisodeView[]>> {
  const user = await requireUser();
  return runAction("loadEpisodes", async () => {
    const parsed = z
      .object({ mediaId: idSchema, seasonNumber: z.number().int().min(0).max(999) })
      .safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const { episodes } = await app().loadSeasonEpisodes({ userId: user.id, ...parsed.data });
    return episodes.map(toEpisodeView);
  });
}

async function readUpload(
  entry: FormDataEntryValue | null,
): Promise<{ filename: string; bytes: Uint8Array } | undefined> {
  if (!(entry instanceof File) || entry.size === 0) return undefined;
  if (entry.size > MAX_UPLOAD_BYTES) {
    throw new AppError("SUBTITLE_INVALID", { key: "tooLarge", params: { mb: MAX_UPLOAD_MB } });
  }
  return { filename: entry.name, bytes: new Uint8Array(await entry.arrayBuffer()) };
}

async function readScriptUpload(
  entry: FormDataEntryValue | null,
): Promise<{ filename: string; bytes: Uint8Array } | undefined> {
  if (!(entry instanceof File) || entry.size === 0) return undefined;
  if (entry.size > MAX_SCRIPT_UPLOAD_BYTES) {
    throw new AppError("SCRIPT_INVALID", { key: "tooLarge", params: { mb: MAX_SCRIPT_UPLOAD_MB } });
  }
  return { filename: entry.name, bytes: new Uint8Array(await entry.arrayBuffer()) };
}

async function scheduleEpisodeAudio(input: {
  userId: string;
  preferences: Preferences;
  episodeId: string;
  label: string;
}): Promise<void> {
  const container = app();
  if (!container.audioBatchAvailable) return;
  const language = input.preferences.targetLanguage;
  const pending = await container.hasPendingJob("episode_audio", { episodeId: input.episodeId, language });
  if (pending) return;
  await scheduleJob(
    container,
    "episode_audio",
    {
      userId: input.userId,
      episodeId: input.episodeId,
      language,
      voice: voiceFor(language, input.preferences.preferredAccent),
      episodeLabel: input.label,
    },
    input.userId,
  );
}

function fullEpisodeLabel(context: EpisodeContext): string {
  return `${context.media.title} · ${episodeLabel(context.media.type, context.season.seasonNumber, context.episode.episodeNumber)}`;
}

async function readSample(language: StudyLanguage) {
  const filename = `sample.${language}.srt`;
  return { filename, bytes: new Uint8Array(await readFile(`${SAMPLES_DIR}/${filename}`)) };
}

export async function uploadSubtitlesAction(form: FormData): Promise<ActionResult<ImportView>> {
  const user = await requireUser();
  return runAction("uploadSubtitles", async () => {
    const fields = z
      .object({
        mediaId: idSchema,
        episodeId: idSchema,
        useSample: z.enum(["true", "false"]).default("false"),
      })
      .safeParse({
        mediaId: form.get("mediaId"),
        episodeId: form.get("episodeId"),
        useSample: form.get("useSample") || undefined,
      });
    if (!fields.success) throw new AppError("INVALID_INPUT");

    const episodeId = fields.data.episodeId;
    const context = await app().getEpisodeContext(episodeId);
    if (!context || context.media.id !== fields.data.mediaId) throw new AppError("EPISODE_NOT_FOUND");
    if (!fields.data.episodeId && context.media.metadataProvider !== "manual")
      throw new AppError("EPISODE_NOT_FOUND");

    const pair = pairOf(user.preferences);
    const sample = fields.data.useSample === "true" && app().devShortcuts;
    const target = sample ? await readSample(pair.target) : await readUpload(form.get("target"));
    const native = sample ? await readSample(pair.native) : await readUpload(form.get("native"));
    const script = await readScriptUpload(form.get("script"));
    const hasTargetSubtitle = context.episode.subtitleLanguages.includes(pair.target);
    if (!target && !(script && hasTargetSubtitle)) throw new AppError("SUBTITLE_INVALID", "targetRequired");

    const result = target
      ? await app().importEpisodeSubtitles({
          userId: user.id,
          episodeId,
          target: { language: pair.target, upload: target },
          native: native ? { language: pair.native, upload: native } : undefined,
        })
      : null;
    const scriptSteps: ProcessingStep[] = script
      ? (
          await app().importEpisodeScript({
            userId: user.id,
            episodeId,
            language: pair.target,
            upload: script,
          })
        ).steps
      : [];
    if (result?.outcome === "PROCESSED") {
      await scheduleEpisodeAudio({
        userId: user.id,
        preferences: user.preferences,
        episodeId,
        label: fullEpisodeLabel(context),
      });
    }
    revalidatePath("/catalog");
    revalidatePath(`/catalog/${context.media.id}`);
    return {
      outcome: result?.outcome ?? "PROCESSED",
      steps: [...(result?.steps ?? []), ...scriptSteps],
      hasNative: result?.hasNative ?? context.episode.subtitleLanguages.includes(pair.native),
      episodeId,
      mediaId: context.media.id,
      seasonNumber: context.season.seasonNumber,
      filename: target?.filename ?? script?.filename ?? "",
    };
  });
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

export async function searchSubtitlesAction(input: unknown): Promise<ActionResult<SubtitleSearchView>> {
  const user = await requireUser();
  return runAction("searchSubtitles", async () => {
    const parsed = z.object({ episodeId: idSchema, refresh: z.boolean().default(false) }).safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const [search, origins] = await Promise.all([
      app().searchSubtitles({ userId: user.id, ...parsed.data }),
      app().listSubtitleOrigins(parsed.data.episodeId),
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
  });
}

export async function importFromSourceAction(input: unknown): Promise<ActionResult<SourceImportView>> {
  const user = await requireUser();
  return runAction("importFromSource", async () => {
    const fileId = z.string().min(1).max(40);
    const parsed = z
      .object({
        mediaId: idSchema,
        episodeId: idSchema,
        targetFileId: fileId,
        nativeFileId: fileId.nullable(),
      })
      .safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const { mediaId, episodeId, targetFileId, nativeFileId } = parsed.data;
    const context = await app().getEpisodeContext(episodeId);
    if (!context || context.media.id !== mediaId) throw new AppError("EPISODE_NOT_FOUND");
    const result = await app().importFromSource({
      userId: user.id,
      episodeId,
      pair: pairOf(user.preferences),
      targetFileId,
      nativeFileId,
    });
    if (result.outcome === "PROCESSED") {
      await scheduleEpisodeAudio({
        userId: user.id,
        preferences: user.preferences,
        episodeId,
        label: fullEpisodeLabel(context),
      });
    }
    revalidatePath("/catalog");
    revalidatePath(`/catalog/${mediaId}`);
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
  });
}

export async function refreshWorkAction(mediaId: unknown): Promise<ActionResult<{ refreshed: boolean }>> {
  const user = await requireUser();
  return runAction("refreshWork", async () => {
    const parsed = idSchema.safeParse(mediaId);
    if (!parsed.success) throw new AppError("MEDIA_NOT_FOUND");
    const result = await app().refreshWork({ userId: user.id, mediaId: parsed.data, force: true });
    revalidatePath(`/catalog/${parsed.data}`);
    return result;
  });
}

export async function studyEpisodeAction(episodeId: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  return runAction("studyEpisode", async () => {
    const parsed = idSchema.safeParse(episodeId);
    if (!parsed.success) throw new AppError("EPISODE_NOT_FOUND");
    await app().startEpisode(user.id, parsed.data);
    await app().updatePreferences(user.id, { currentEpisodeId: parsed.data });
    revalidatePath("/");
    return null;
  });
}

const tmdbWorkSchema = z.object({ type: mediaTypeSchema, externalId: z.string().regex(/^(tv|movie):\d+$/) });

export async function openTmdbWorkAction(input: unknown): Promise<ActionResult<{ mediaId: string }>> {
  const user = await requireUser();
  return runAction("openTmdbWork", async () => {
    const parsed = tmdbWorkSchema.safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const { mediaId } = await app().registerWork({ userId: user.id, ...parsed.data });
    revalidatePath("/catalog");
    return { mediaId };
  });
}

export async function rateWorkLevelAction(
  input: unknown,
): Promise<ActionResult<{ range: string; reason: string; ratings: number }>> {
  const user = await requireUser();
  return runAction("rateWorkLevel", async () => {
    const parsed = tmdbWorkSchema.safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const rated = await app().rateWorkLevel({
      actor: { userId: user.id, isAdmin: user.isAdmin },
      ...parsed.data,
    });
    revalidatePath("/catalog", "layout");
    const [min, max] = rated.range ?? rated.ai.range;
    return { range: `${min}–${max}`, reason: rated.ai.reason, ratings: rated.ratings.length };
  });
}
