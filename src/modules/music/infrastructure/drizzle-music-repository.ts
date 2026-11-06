import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/infrastructure/database/client";
import { qualified } from "@/infrastructure/database/qualified";
import {
  episodes,
  mediaItems,
  seasons,
  songTracks,
  subtitleFiles,
  users,
} from "@/infrastructure/database/schema";
import { DEFAULT_LEVEL_RANGE, posterColorsFor } from "@/modules/catalog";
import { AppError } from "@/shared/errors";
import { isStudyLanguage } from "@/shared/study-languages";
import type { MusicRepository, NewPlaylist, NewSong } from "../application/ports";
import {
  MUSIC_MEDIA_TYPE,
  MUSIC_PROVIDER,
  MUSIC_SEASON_NUMBER,
  MUSIC_SEASON_TITLE,
  lyricsSourceSchema,
  songTranslationSourceSchema,
  type Playlist,
  type Song,
  type SongEntry,
  type SongTranslationSource,
} from "../domain/music";
import { pauseSchema, type SongTiming } from "../domain/timeline";

const MS_PER_SECOND = 1000;
const EPISODE_STATUSES = ["NONE", "UPLOADED", "PROCESSING", "READY", "FAILED", "NEEDS_REVIEW"] as const;
const pausesSchema = z.array(pauseSchema);

type TrackRow = typeof songTracks.$inferSelect;

class DuplicateSong extends Error {}

const songCount = sql<number>`(select count(*)::int from ${episodes} inner join ${seasons} on ${qualified(seasons.id)} = ${qualified(episodes.seasonId)} where ${qualified(seasons.mediaItemId)} = ${qualified(mediaItems.id)})`;

const subtitleLanguagesOf = sql<
  string[] | null
>`(select array_agg(${subtitleFiles.language} order by ${subtitleFiles.language}) from ${subtitleFiles} where ${subtitleFiles.episodeId} = ${episodes}.id)`;

function toSong(row: TrackRow): Song {
  const pauses = pausesSchema.safeParse(row.pauses);
  const lyricsSource = lyricsSourceSchema.safeParse(row.lyricsSource);
  const translationSource = songTranslationSourceSchema.safeParse(row.translationSource);
  return {
    episodeId: row.episodeId,
    mediaItemId: row.mediaItemId,
    youtubeVideoId: row.youtubeVideoId,
    artist: row.artist,
    trackTitle: row.trackTitle,
    durationMs: row.durationMs,
    leadInMs: row.leadInMs,
    pauses: pauses.success ? pauses.data : [],
    lyricsSource: lyricsSource.success ? lyricsSource.data : "manual",
    lyricsExternalId: row.lyricsExternalId,
    translationSource: translationSource.success ? translationSource.data : "none",
  };
}

function toPlaylist(row: {
  media: typeof mediaItems.$inferSelect;
  creatorName: string | null;
  songs: number;
}): Playlist {
  return {
    id: row.media.id,
    title: row.media.title,
    overview: row.media.overview,
    createdBy: row.media.createdBy,
    createdByName: row.creatorName,
    songCount: row.songs,
  };
}

export class DrizzleMusicRepository implements MusicRepository {
  constructor(private readonly db: Database) {}

  private playlistQuery() {
    return this.db
      .select({ media: mediaItems, creatorName: users.name, songs: songCount })
      .from(mediaItems)
      .leftJoin(users, eq(users.id, mediaItems.createdBy));
  }

  async ensurePlaylist(input: NewPlaylist): Promise<Playlist> {
    await this.db.transaction(async (tx) => {
      await tx
        .insert(mediaItems)
        .values({
          id: input.id,
          type: MUSIC_MEDIA_TYPE,
          title: input.title,
          originalTitle: input.title,
          overview: input.overview,
          year: null,
          metadataProvider: MUSIC_PROVIDER,
          externalId: input.externalId,
          posterPath: null,
          backdropPath: null,
          posterColors: posterColorsFor(input.title),
          levelMin: DEFAULT_LEVEL_RANGE[0],
          levelMax: DEFAULT_LEVEL_RANGE[1],
          accent: null,
          originalLanguage: input.language,
          genres: [],
          createdBy: input.createdBy,
          metadataSyncedAt: null,
          createdAt: input.now,
        })
        .onConflictDoNothing();
      const [media] = await tx
        .select({ id: mediaItems.id })
        .from(mediaItems)
        .where(
          and(eq(mediaItems.metadataProvider, MUSIC_PROVIDER), eq(mediaItems.externalId, input.externalId)),
        )
        .limit(1);
      if (!media) throw new Error("falha ao gravar a playlist");
      await tx
        .insert(seasons)
        .values({
          id: input.seasonId,
          mediaItemId: media.id,
          seasonNumber: MUSIC_SEASON_NUMBER,
          title: MUSIC_SEASON_TITLE,
          episodeCount: null,
        })
        .onConflictDoNothing();
    });
    const [row] = await this.playlistQuery()
      .where(
        and(eq(mediaItems.metadataProvider, MUSIC_PROVIDER), eq(mediaItems.externalId, input.externalId)),
      )
      .limit(1);
    if (!row) throw new Error("falha ao ler a playlist");
    return toPlaylist(row);
  }

  async findPlaylist(playlistId: string): Promise<Playlist | null> {
    const [row] = await this.playlistQuery()
      .where(and(eq(mediaItems.id, playlistId), eq(mediaItems.type, MUSIC_MEDIA_TYPE)))
      .limit(1);
    return row ? toPlaylist(row) : null;
  }

  async listPlaylists(): Promise<Playlist[]> {
    const rows = await this.playlistQuery()
      .where(eq(mediaItems.type, MUSIC_MEDIA_TYPE))
      .orderBy(asc(mediaItems.createdAt), asc(mediaItems.title));
    return rows.map(toPlaylist);
  }

  async countPlaylistsBy(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(mediaItems)
      .where(and(eq(mediaItems.type, MUSIC_MEDIA_TYPE), eq(mediaItems.createdBy, userId)));
    return row?.total ?? 0;
  }

  private entryQuery() {
    return this.db
      .select({ track: songTracks, episode: episodes, subtitleLanguages: subtitleLanguagesOf })
      .from(songTracks)
      .innerJoin(episodes, eq(episodes.id, songTracks.episodeId));
  }

  private toEntry(row: {
    track: TrackRow;
    episode: typeof episodes.$inferSelect;
    subtitleLanguages: string[] | null;
  }): SongEntry {
    return {
      ...toSong(row.track),
      episodeNumber: row.episode.episodeNumber,
      status: EPISODE_STATUSES.find((status) => status === row.episode.status) ?? "NONE",
      cueCount: row.episode.cueCount,
      subtitleLanguages: (row.subtitleLanguages ?? []).filter(isStudyLanguage),
    };
  }

  async listSongs(playlistId: string): Promise<SongEntry[]> {
    const rows = await this.entryQuery()
      .where(eq(songTracks.mediaItemId, playlistId))
      .orderBy(asc(episodes.episodeNumber));
    return rows.map((row) => this.toEntry(row));
  }

  async findSong(episodeId: string): Promise<(SongEntry & { playlist: Playlist }) | null> {
    const [row] = await this.entryQuery().where(eq(songTracks.episodeId, episodeId)).limit(1);
    if (!row) return null;
    const playlist = await this.findPlaylist(row.track.mediaItemId);
    return playlist ? { ...this.toEntry(row), playlist } : null;
  }

  async findSongByVideo(playlistId: string, youtubeVideoId: string): Promise<SongEntry | null> {
    const [row] = await this.entryQuery()
      .where(and(eq(songTracks.mediaItemId, playlistId), eq(songTracks.youtubeVideoId, youtubeVideoId)))
      .limit(1);
    return row ? this.toEntry(row) : null;
  }

  async createSong(input: NewSong): Promise<{ episodeId: string; created: boolean }> {
    try {
      return await this.db.transaction(async (tx) => {
        const [season] = await tx
          .select({ id: seasons.id })
          .from(seasons)
          .where(
            and(eq(seasons.mediaItemId, input.playlistId), eq(seasons.seasonNumber, MUSIC_SEASON_NUMBER)),
          )
          .limit(1);
        if (!season) throw new AppError("MEDIA_NOT_FOUND");
        const [last] = await tx
          .select({ number: sql<number | null>`max(${episodes.episodeNumber})` })
          .from(episodes)
          .where(eq(episodes.seasonId, season.id));
        await tx.insert(episodes).values({
          id: input.episodeId,
          seasonId: season.id,
          episodeNumber: (last?.number ?? 0) + 1,
          title: input.title,
          overview: input.overview,
          durationSeconds: input.song.durationMs ? Math.round(input.song.durationMs / MS_PER_SECOND) : null,
          stillPath: null,
          status: "NONE",
          cueCount: 0,
        });
        const inserted = await tx
          .insert(songTracks)
          .values({
            episodeId: input.episodeId,
            mediaItemId: input.playlistId,
            youtubeVideoId: input.song.youtubeVideoId,
            artist: input.song.artist,
            trackTitle: input.song.trackTitle,
            durationMs: input.song.durationMs,
            leadInMs: input.song.leadInMs,
            pauses: input.song.pauses,
            lyricsSource: input.song.lyricsSource,
            lyricsExternalId: input.song.lyricsExternalId,
            translationSource: input.song.translationSource,
            createdAt: input.now,
          })
          .onConflictDoNothing()
          .returning({ episodeId: songTracks.episodeId });
        if (inserted.length === 0) throw new DuplicateSong();
        return { episodeId: input.episodeId, created: true };
      });
    } catch (error) {
      if (!(error instanceof DuplicateSong)) throw error;
      const existing = await this.findSongByVideo(input.playlistId, input.song.youtubeVideoId);
      if (!existing) throw error;
      return { episodeId: existing.episodeId, created: false };
    }
  }

  async removeSong(episodeId: string): Promise<void> {
    await this.db.delete(episodes).where(eq(episodes.id, episodeId));
  }

  async updateTiming(episodeId: string, timing: SongTiming): Promise<void> {
    await this.db
      .update(songTracks)
      .set({ leadInMs: timing.leadInMs, pauses: timing.pauses })
      .where(eq(songTracks.episodeId, episodeId));
  }

  async updateTranslationSource(episodeId: string, source: SongTranslationSource): Promise<void> {
    await this.db
      .update(songTracks)
      .set({ translationSource: source })
      .where(eq(songTracks.episodeId, episodeId));
  }

  async listTracks(playlistId: string): Promise<Song[]> {
    const rows = await this.db.select().from(songTracks).where(eq(songTracks.mediaItemId, playlistId));
    return rows.map(toSong);
  }

  async upsertTrack(song: Song): Promise<void> {
    await this.db
      .insert(songTracks)
      .values({
        episodeId: song.episodeId,
        mediaItemId: song.mediaItemId,
        youtubeVideoId: song.youtubeVideoId,
        artist: song.artist,
        trackTitle: song.trackTitle,
        durationMs: song.durationMs,
        leadInMs: song.leadInMs,
        pauses: song.pauses,
        lyricsSource: song.lyricsSource,
        lyricsExternalId: song.lyricsExternalId,
        translationSource: song.translationSource,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  }
}
