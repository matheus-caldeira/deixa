import { z } from "zod";
import type { StudyLanguage } from "@/shared/study-languages";
import type { SongPause } from "./timeline";

export const MUSIC_MEDIA_TYPE = "music" as const;
export const MUSIC_PROVIDER = "manual" as const;
export const MUSIC_SEASON_NUMBER = 1;
export const MUSIC_SEASON_TITLE = "Músicas";
export const DEFAULT_PLAYLIST_TITLE = "Minhas músicas";
export const MAX_PLAYLIST_TITLE = 80;
export const MAX_SONG_FIELD = 120;
export const MAX_PLAYLISTS_PER_USER = 50;
export const MAX_SONGS_PER_PLAYLIST = 200;
export const MAX_SEARCH_RESULTS = 10;

export const LYRICS_SOURCES = ["lrclib", "fake", "manual"] as const;
export type LyricsSourceName = (typeof LYRICS_SOURCES)[number];
export const lyricsSourceSchema = z.enum(LYRICS_SOURCES);

export const SONG_TRANSLATION_SOURCES = ["llm", "manual", "none"] as const;
export type SongTranslationSource = (typeof SONG_TRANSLATION_SOURCES)[number];
export const songTranslationSourceSchema = z.enum(SONG_TRANSLATION_SOURCES);

export const playlistExternalId = (key: string): string => `playlist:${key}`;
export const defaultPlaylistExternalId = (userId: string): string => `playlist:default-${userId}`;

export type Playlist = {
  id: string;
  title: string;
  overview: string;
  createdBy: string | null;
  createdByName: string | null;
  songCount: number;
};

export type Song = {
  episodeId: string;
  mediaItemId: string;
  youtubeVideoId: string;
  artist: string;
  trackTitle: string;
  durationMs: number | null;
  leadInMs: number;
  pauses: SongPause[];
  lyricsSource: LyricsSourceName;
  lyricsExternalId: string | null;
  translationSource: SongTranslationSource;
};

export type SongEntry = Song & {
  episodeNumber: number;
  status: "NONE" | "UPLOADED" | "PROCESSING" | "READY" | "FAILED" | "NEEDS_REVIEW";
  cueCount: number;
  subtitleLanguages: StudyLanguage[];
};

export type Actor = { userId: string; isAdmin: boolean };

export function canEditPlaylist(playlist: Pick<Playlist, "createdBy">, actor: Actor): boolean {
  return actor.isAdmin || playlist.createdBy === actor.userId;
}

export function songSlug(artist: string, title: string): string {
  const slug = `${artist}-${title}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "song";
}
