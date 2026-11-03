import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { isStudyLanguage } from "@/shared/study-languages";
import type { Database } from "@/infrastructure/database/client";
import { qualified } from "@/infrastructure/database/qualified";
import {
  episodeProgress,
  episodes,
  mediaItems,
  seasons,
  subtitleFiles,
  users,
} from "@/infrastructure/database/schema";
import { isCefrLevel, type CefrLevel } from "@/shared/levels";
import {
  posterColorsFor,
  type Episode,
  type EpisodeContext,
  type EpisodeStatus,
  type MediaItem,
  type MetadataSource,
  type PosterColors,
  type Season,
  type WorkGenre,
} from "../domain/catalog";
import type {
  CatalogEntry,
  CatalogRepository,
  EpisodeProgressEntry,
  EpisodeProgressRepository,
  EpisodeUpsert,
  EpisodeWithSeason,
  MediaUpsert,
  SeasonUpsert,
} from "../application/ports";

const EPISODE_STATUSES: readonly EpisodeStatus[] = [
  "NONE",
  "UPLOADED",
  "PROCESSING",
  "READY",
  "FAILED",
  "NEEDS_REVIEW",
];
const IN_PROGRESS = "IN_PROGRESS";
const COMPLETED = "COMPLETED";
const COMPLETE_PERCENT = 100;

type MediaRow = typeof mediaItems.$inferSelect;
type SeasonRow = typeof seasons.$inferSelect;
type EpisodeRow = typeof episodes.$inferSelect;

function toPosterColors(value: unknown, title: string): PosterColors {
  const candidate = value as Partial<PosterColors> | null;
  if (
    candidate &&
    typeof candidate.c1 === "string" &&
    typeof candidate.c2 === "string" &&
    typeof candidate.fg === "string"
  ) {
    return { c1: candidate.c1, c2: candidate.c2, fg: candidate.fg };
  }
  return posterColorsFor(title);
}

const genresSchema = z.array(z.object({ id: z.number().int().nullable(), name: z.string().min(1) }));

function toGenres(value: unknown): WorkGenre[] {
  const parsed = genresSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

function toMedia(row: MediaRow, uploaderName: string | null): MediaItem {
  return {
    id: row.id,
    type: row.type === "movie" ? "movie" : "series",
    title: row.title,
    originalTitle: row.originalTitle,
    overview: row.overview,
    year: row.year,
    metadataProvider:
      row.metadataProvider === "tmdb" || row.metadataProvider === "fake" ? row.metadataProvider : "manual",
    externalId: row.externalId,
    posterPath: row.posterPath,
    backdropPath: row.backdropPath,
    posterColors: toPosterColors(row.posterColors, row.title),
    levelMin: isCefrLevel(row.levelMin) ? row.levelMin : "B1",
    levelMax: isCefrLevel(row.levelMax) ? row.levelMax : "B2",
    accent: row.accent,
    originalLanguage: isStudyLanguage(row.originalLanguage) ? row.originalLanguage : "en",
    genres: toGenres(row.genres),
    uploaderName,
    metadataSyncedAt: row.metadataSyncedAt,
  };
}

function toSeason(row: SeasonRow): Season {
  return {
    id: row.id,
    mediaItemId: row.mediaItemId,
    seasonNumber: row.seasonNumber,
    title: row.title,
    episodeCount: row.episodeCount,
    episodesSyncedAt: row.episodesSyncedAt,
  };
}

function toEpisode(row: EpisodeRow, subtitleLanguages: string[] | null): Episode {
  return {
    id: row.id,
    seasonId: row.seasonId,
    episodeNumber: row.episodeNumber,
    title: row.title,
    overview: row.overview,
    durationSeconds: row.durationSeconds,
    stillPath: row.stillPath,
    status: EPISODE_STATUSES.find((status) => status === row.status) ?? "NONE",
    failureReason: row.failureReason,
    cueCount: row.cueCount,
    alignmentPairs: row.alignmentPairs,
    alignmentRate: row.alignmentRate,
    subtitleLanguages: (subtitleLanguages ?? []).filter(isStudyLanguage),
  };
}

const subtitleLanguagesOf = sql<
  string[] | null
>`(select array_agg(${subtitleFiles.language} order by ${subtitleFiles.language}) from ${subtitleFiles} where ${subtitleFiles.episodeId} = ${episodes}.id)`;

export class DrizzleCatalogRepository implements CatalogRepository, EpisodeProgressRepository {
  constructor(private readonly db: Database) {}

  private mediaQuery() {
    return this.db
      .select({ media: mediaItems, uploaderName: users.name })
      .from(mediaItems)
      .leftJoin(users, eq(users.id, mediaItems.createdBy));
  }

  async findMediaById(id: string): Promise<MediaItem | null> {
    const [row] = await this.mediaQuery().where(eq(mediaItems.id, id)).limit(1);
    return row ? toMedia(row.media, row.uploaderName) : null;
  }

  async findMediaByExternal(provider: MetadataSource, externalId: string): Promise<MediaItem | null> {
    const [row] = await this.mediaQuery()
      .where(and(eq(mediaItems.metadataProvider, provider), eq(mediaItems.externalId, externalId)))
      .limit(1);
    return row ? toMedia(row.media, row.uploaderName) : null;
  }

  async updateLevelRange(mediaId: string, range: readonly [CefrLevel, CefrLevel]): Promise<void> {
    await this.db
      .update(mediaItems)
      .set({ levelMin: range[0], levelMax: range[1] })
      .where(eq(mediaItems.id, mediaId));
  }

  async upsertMedia(input: MediaUpsert): Promise<string> {
    const [row] = await this.db
      .insert(mediaItems)
      .values({
        id: input.id,
        type: input.type,
        title: input.title,
        originalTitle: input.originalTitle,
        overview: input.overview,
        year: input.year,
        metadataProvider: input.metadataProvider,
        externalId: input.externalId,
        posterPath: input.posterPath,
        backdropPath: input.backdropPath,
        posterColors: input.posterColors,
        levelMin: input.levelMin,
        levelMax: input.levelMax,
        accent: input.accent,
        originalLanguage: input.originalLanguage,
        genres: input.genres ?? [],
        createdBy: input.createdBy,
        metadataSyncedAt: input.syncedAt,
        createdAt: input.createdAt,
      })
      .onConflictDoUpdate({
        target: [mediaItems.metadataProvider, mediaItems.externalId],
        set: {
          title: input.title,
          originalTitle: input.originalTitle,
          overview: input.overview,
          year: input.year,
          posterPath: input.posterPath,
          backdropPath: input.backdropPath,
          metadataSyncedAt: input.syncedAt,
          ...(input.genres ? { genres: input.genres } : {}),
        },
      })
      .returning({ id: mediaItems.id });
    if (!row) throw new Error("falha ao gravar a obra");
    return row.id;
  }

  async upsertSeasons(mediaItemId: string, items: SeasonUpsert[]): Promise<void> {
    if (items.length === 0) return;
    await this.db
      .insert(seasons)
      .values(items.map((season) => ({ ...season, mediaItemId })))
      .onConflictDoUpdate({
        target: [seasons.mediaItemId, seasons.seasonNumber],
        set: {
          title: sql`excluded.title`,
          episodeCount: sql`coalesce(excluded.episode_count, ${seasons.episodeCount})`,
        },
      });
  }

  async listSeasons(mediaItemId: string): Promise<Season[]> {
    const rows = await this.db
      .select()
      .from(seasons)
      .where(eq(seasons.mediaItemId, mediaItemId))
      .orderBy(asc(seasons.seasonNumber));
    return rows.map(toSeason);
  }

  async upsertEpisodes(seasonId: string, items: EpisodeUpsert[], syncedAt: Date | null): Promise<void> {
    await this.db.transaction(async (tx) => {
      if (items.length > 0) {
        await tx
          .insert(episodes)
          .values(items.map((episode) => ({ ...episode, seasonId, status: "NONE", cueCount: 0 })))
          .onConflictDoUpdate({
            target: [episodes.seasonId, episodes.episodeNumber],
            set: {
              title: sql`excluded.title`,
              overview: sql`excluded.overview`,
              durationSeconds: sql`coalesce(excluded.duration_seconds, ${episodes.durationSeconds})`,
              stillPath: sql`coalesce(excluded.still_path, ${episodes.stillPath})`,
            },
          });
      }
      if (syncedAt)
        await tx.update(seasons).set({ episodesSyncedAt: syncedAt }).where(eq(seasons.id, seasonId));
    });
  }

  async listEpisodes(seasonId: string): Promise<Episode[]> {
    const rows = await this.db
      .select({ episode: episodes, subtitleLanguages: subtitleLanguagesOf })
      .from(episodes)
      .where(eq(episodes.seasonId, seasonId))
      .orderBy(asc(episodes.episodeNumber));
    return rows.map((row) => toEpisode(row.episode, row.subtitleLanguages));
  }

  async listEpisodesByMedia(mediaItemId: string): Promise<EpisodeWithSeason[]> {
    const rows = await this.db
      .select({
        episode: episodes,
        seasonNumber: seasons.seasonNumber,
        subtitleLanguages: subtitleLanguagesOf,
      })
      .from(episodes)
      .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
      .where(eq(seasons.mediaItemId, mediaItemId))
      .orderBy(asc(seasons.seasonNumber), asc(episodes.episodeNumber));
    return rows.map((row) => ({
      ...toEpisode(row.episode, row.subtitleLanguages),
      seasonNumber: row.seasonNumber,
    }));
  }

  async listCatalog(): Promise<CatalogEntry[]> {
    const readyEpisodes = sql<number>`(select count(*)::int from ${episodes} inner join ${seasons} on ${qualified(seasons.id)} = ${qualified(episodes.seasonId)} where ${qualified(seasons.mediaItemId)} = ${qualified(mediaItems.id)} and ${qualified(episodes.status)} = 'READY')`;
    const rows = await this.db
      .select({ media: mediaItems, uploaderName: users.name, readyEpisodes })
      .from(mediaItems)
      .leftJoin(users, eq(users.id, mediaItems.createdBy))
      .orderBy(asc(mediaItems.createdAt), asc(mediaItems.title));
    return rows.map((row) => ({
      media: toMedia(row.media, row.uploaderName),
      readyEpisodes: row.readyEpisodes,
    }));
  }

  async findEpisodeContext(episodeId: string): Promise<EpisodeContext | null> {
    const [row] = await this.db
      .select({
        episode: episodes,
        season: seasons,
        media: mediaItems,
        uploaderName: users.name,
        subtitleLanguages: subtitleLanguagesOf,
      })
      .from(episodes)
      .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
      .innerJoin(mediaItems, eq(mediaItems.id, seasons.mediaItemId))
      .leftJoin(users, eq(users.id, mediaItems.createdBy))
      .where(eq(episodes.id, episodeId))
      .limit(1);
    if (!row) return null;
    return {
      episode: toEpisode(row.episode, row.subtitleLanguages),
      season: toSeason(row.season),
      media: toMedia(row.media, row.uploaderName),
    };
  }

  async listForUser(userId: string): Promise<EpisodeProgressEntry[]> {
    return this.db
      .select({ episodeId: episodeProgress.episodeId, progressPercent: episodeProgress.progressPercent })
      .from(episodeProgress)
      .where(eq(episodeProgress.userId, userId))
      .orderBy(asc(episodeProgress.updatedAt));
  }

  async upsert(userId: string, episodeId: string, progressPercent: number, now: Date): Promise<void> {
    const completed = progressPercent >= COMPLETE_PERCENT;
    const values = {
      status: completed ? COMPLETED : IN_PROGRESS,
      progressPercent,
      completedAt: completed ? now : null,
      updatedAt: now,
    };
    await this.db
      .insert(episodeProgress)
      .values({ userId, episodeId, ...values })
      .onConflictDoUpdate({ target: [episodeProgress.userId, episodeProgress.episodeId], set: values });
  }
}
