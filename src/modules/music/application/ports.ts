import type { EpisodeScript } from "@/modules/subtitles";
import type { LanguagePair, StudyLanguage } from "@/shared/study-languages";
import type { LyricsSourceName, Playlist, Song, SongEntry, SongTranslationSource } from "../domain/music";
import type { SongTiming } from "../domain/timeline";

export type LyricsCandidate = {
  id: string;
  artist: string;
  title: string;
  album: string | null;
  durationMs: number | null;
  synced: boolean;
  instrumental: boolean;
};

export type LyricsDocument = LyricsCandidate & { syncedLrc: string | null; plain: string | null };

export type LyricsQuery = { query?: string; artist?: string; title?: string };

export interface LyricsProvider {
  readonly name: Exclude<LyricsSourceName, "manual">;
  search(query: LyricsQuery): Promise<LyricsCandidate[]>;
  get(id: string): Promise<LyricsDocument | null>;
}

export type NewPlaylist = {
  id: string;
  seasonId: string;
  externalId: string;
  title: string;
  overview: string;
  language: StudyLanguage;
  createdBy: string;
  now: Date;
};

export type NewSong = {
  playlistId: string;
  episodeId: string;
  title: string;
  overview: string;
  now: Date;
  song: Omit<Song, "episodeId" | "mediaItemId">;
};

export type PlaylistSummary = Playlist & { owned: boolean };

export interface MusicRepository {
  ensurePlaylist(input: NewPlaylist): Promise<Playlist>;
  findPlaylist(playlistId: string): Promise<Playlist | null>;
  listPlaylists(): Promise<Playlist[]>;
  countPlaylistsBy(userId: string): Promise<number>;
  listSongs(playlistId: string): Promise<SongEntry[]>;
  findSong(episodeId: string): Promise<(SongEntry & { playlist: Playlist }) | null>;
  findSongByVideo(playlistId: string, youtubeVideoId: string): Promise<SongEntry | null>;
  createSong(input: NewSong): Promise<{ episodeId: string; created: boolean }>;
  removeSong(episodeId: string): Promise<void>;
  updateTiming(episodeId: string, timing: SongTiming): Promise<void>;
  updateTranslationSource(episodeId: string, source: SongTranslationSource): Promise<void>;
  listTracks(playlistId: string): Promise<Song[]>;
  upsertTrack(song: Song): Promise<void>;
}

export type SongCue = { id: string; sequence: number; startMs: number; endMs: number; text: string };

export type SongSubtitleUpload = {
  language: StudyLanguage;
  upload: { filename: string; bytes: Uint8Array };
};

export interface SongSubtitles {
  importSubtitles(input: {
    userId: string;
    episodeId: string;
    target: SongSubtitleUpload;
    native?: SongSubtitleUpload;
  }): Promise<{ outcome: "PROCESSED" | "DUPLICATE"; cueCount: number }>;
  listCues(episodeId: string, language: StudyLanguage): Promise<SongCue[] | null>;
  readOriginal(episodeId: string, language: StudyLanguage): Promise<Uint8Array | null>;
  script(episodeId: string, pair: LanguagePair): Promise<EpisodeScript | null>;
}

export type SongLlm = {
  translateLines(lines: { id: string; text: string }[], pair: LanguagePair): Promise<unknown>;
};
export type ResolveSongLlm = (userId: string) => Promise<SongLlm>;
