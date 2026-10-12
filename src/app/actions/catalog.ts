"use server";

import { readFile } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { posterUrl, type Episode, type MediaItem, type Season } from "@/modules/catalog";
import { AppError } from "@/shared/errors";
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

const SAMPLE_ENGLISH = "fixtures/sample.en.srt";
const SAMPLE_PORTUGUESE = "fixtures/sample.pt-BR.srt";
const MAX_UPLOAD_BYTES = 5_000_000;
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
    hasPortuguese: episode.hasPortuguese,
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
    throw new AppError("SUBTITLE_INVALID", "Arquivo maior que 5 MB. Confira se é o arquivo certo.");
  }
  return { filename: entry.name, bytes: new Uint8Array(await entry.arrayBuffer()) };
}

async function readSample(path: string, filename: string) {
  return { filename, bytes: new Uint8Array(await readFile(path)) };
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

    const sample = fields.data.useSample === "true" && app().devShortcuts;
    const english = sample
      ? await readSample(SAMPLE_ENGLISH, "sample.en.srt")
      : await readUpload(form.get("english"));
    const portuguese = sample
      ? await readSample(SAMPLE_PORTUGUESE, "sample.pt-BR.srt")
      : await readUpload(form.get("portuguese"));
    if (!english) throw new AppError("SUBTITLE_INVALID", "Envie a legenda em inglês (.srt).");

    const result = await app().importEpisodeSubtitles({ userId: user.id, episodeId, english, portuguese });
    revalidatePath("/catalog");
    revalidatePath(`/catalog/${context.media.id}`);
    return {
      outcome: result.outcome,
      steps: result.steps,
      hasPortuguese: result.hasPortuguese,
      episodeId,
      mediaId: context.media.id,
      seasonNumber: context.season.seasonNumber,
      filename: english.filename,
    };
  });
}

const quotaView = (quota: { remaining: number; resetAt: Date | null } | null) =>
  quota ? { remaining: quota.remaining, resetAt: quota.resetAt?.toISOString() ?? null } : null;

export async function searchSubtitlesAction(input: unknown): Promise<ActionResult<SubtitleSearchView>> {
  const user = await requireUser();
  return runAction("searchSubtitles", async () => {
    const parsed = z.object({ episodeId: idSchema, refresh: z.boolean().default(false) }).safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const [search, origins] = await Promise.all([
      app().searchSubtitles({ userId: user.id, ...parsed.data }),
      app().listSubtitleOrigins(parsed.data.episodeId),
    ]);
    const toOption = (candidate: (typeof search.ranking.english)[number]): SubtitleOptionView => ({
      fileId: candidate.fileId,
      language: candidate.language,
      release: candidate.release.slice(0, MAX_RELEASE_CHARS),
      downloads: candidate.downloads,
      hearingImpaired: candidate.hearingImpaired,
      machineTranslated: candidate.machineTranslated,
      uploader: candidate.uploader?.slice(0, MAX_UPLOADER_CHARS) ?? null,
    });
    const english = origins.find((file) => file.language === "en");
    const portuguese = origins.find((file) => file.language === "pt-BR");
    return {
      provider: search.provider,
      english: search.ranking.english.slice(0, MAX_OPTIONS).map(toOption),
      portuguese: search.ranking.portuguese.slice(0, MAX_OPTIONS).map(toOption),
      suggestion: {
        englishFileId: search.ranking.suggestion.english?.fileId ?? null,
        portugueseFileId: search.ranking.suggestion.portuguese?.fileId ?? null,
        sameRelease: search.ranking.suggestion.sameRelease,
      },
      existing: {
        english: english?.origin?.externalFileId ?? null,
        portuguese: portuguese?.origin?.externalFileId ?? null,
        hasEnglish: Boolean(english),
        hasPortuguese: Boolean(portuguese),
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
        englishFileId: fileId,
        portugueseFileId: fileId.nullable(),
      })
      .safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const { mediaId, episodeId, englishFileId, portugueseFileId } = parsed.data;
    const context = await app().getEpisodeContext(episodeId);
    if (!context || context.media.id !== mediaId) throw new AppError("EPISODE_NOT_FOUND");
    const result = await app().importFromSource({
      userId: user.id,
      episodeId,
      englishFileId,
      portugueseFileId,
    });
    revalidatePath("/catalog");
    revalidatePath(`/catalog/${mediaId}`);
    return {
      outcome: result.outcome,
      steps: [
        {
          label: "Baixando do OpenSubtitles",
          detail:
            result.downloadsUsed === 0 ? "já estava no catálogo" : `${result.downloadsUsed} download(s)`,
        },
        ...result.steps,
      ],
      hasPortuguese: result.hasPortuguese,
      episodeId,
      mediaId,
      seasonNumber: context.season.seasonNumber,
      filename: "legendas do OpenSubtitles",
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
