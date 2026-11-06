import type { Clock } from "@/shared/clock";
import { AppError } from "@/shared/errors";
import type { IdGenerator } from "@/shared/ids";
import type { LanguagePair } from "@/shared/study-languages";
import { MAX_LRC_CHARS, cuesToSrt, lrcToCues, parseLrc } from "../domain/lrc";
import {
  MAX_SONGS_PER_PLAYLIST,
  MAX_SONG_FIELD,
  songSlug,
  type Actor,
  type LyricsSourceName,
} from "../domain/music";
import { parseYoutubeVideoId } from "../domain/timeline";
import { alignPastedTranslation } from "../domain/translation";
import { loadEditablePlaylist } from "./access";
import type { LyricsProvider, MusicRepository, SongSubtitles } from "./ports";

export type LyricsInput = { kind: "provider"; lyricsId: string } | { kind: "lrc"; text: string };

export type AddSongInput = Actor & {
  playlistId: string;
  videoUrl: string;
  artist: string;
  title: string;
  pair: LanguagePair;
  lyrics: LyricsInput;
  translationText?: string | null;
  translateWithAi: boolean;
};

export type AddSongResult = {
  episodeId: string;
  created: boolean;
  cueCount: number;
  translationSource: "manual" | "none";
  translationPending: boolean;
};

const encoder = new TextEncoder();

function field(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length === 0 || text.length > MAX_SONG_FIELD) throw new AppError("INVALID_INPUT");
  return text;
}

export function makeAddSong(deps: {
  music: MusicRepository;
  lyrics: LyricsProvider;
  subtitles: SongSubtitles;
  ids: IdGenerator;
  clock: Clock;
}) {
  async function loadLyrics(input: LyricsInput) {
    if (input.kind === "lrc") {
      if (input.text.length > MAX_LRC_CHARS) throw new AppError("MUSIC_LYRICS_UNAVAILABLE");
      return {
        lrc: input.text,
        durationMs: null,
        source: "manual" as LyricsSourceName,
        externalId: null,
      };
    }
    const document = await deps.lyrics.get(input.lyricsId);
    if (!document?.syncedLrc) throw new AppError("MUSIC_LYRICS_UNAVAILABLE");
    return {
      lrc: document.syncedLrc,
      durationMs: document.durationMs,
      source: deps.lyrics.name as LyricsSourceName,
      externalId: document.id,
    };
  }

  return async function addSong(input: AddSongInput): Promise<AddSongResult> {
    const youtubeVideoId = parseYoutubeVideoId(input.videoUrl);
    const artist = field(input.artist);
    const trackTitle = field(input.title);
    await loadEditablePlaylist(deps.music, input.playlistId, input);

    const existing = await deps.music.findSongByVideo(input.playlistId, youtubeVideoId);
    if (existing?.status === "READY") {
      return {
        episodeId: existing.episodeId,
        created: false,
        cueCount: existing.cueCount,
        translationSource: existing.translationSource === "manual" ? "manual" : "none",
        translationPending: false,
      };
    }
    if (existing) await deps.music.removeSong(existing.episodeId);
    if ((await deps.music.listSongs(input.playlistId)).length >= MAX_SONGS_PER_PLAYLIST) {
      throw new AppError("INVALID_INPUT", "tooManySongs");
    }

    const lyrics = await loadLyrics(input.lyrics);
    const cues = lrcToCues(parseLrc(lyrics.lrc).lines, { durationMs: lyrics.durationMs });
    if (cues.length === 0) throw new AppError("SUBTITLE_INVALID", "noCues");
    const pastedText = input.translationText?.trim() ?? "";
    const translated = pastedText ? alignPastedTranslation(pastedText, cues) : null;
    const lastEnd = cues[cues.length - 1]?.endMs ?? null;

    const episodeId = deps.ids.next();
    const slug = songSlug(artist, trackTitle);
    const { created, episodeId: storedId } = await deps.music.createSong({
      playlistId: input.playlistId,
      episodeId,
      title: trackTitle,
      overview: artist,
      now: deps.clock.now(),
      song: {
        youtubeVideoId,
        artist,
        trackTitle,
        durationMs: lyrics.durationMs ?? lastEnd,
        leadInMs: 0,
        pauses: [],
        lyricsSource: lyrics.source,
        lyricsExternalId: lyrics.externalId,
        translationSource: translated ? "manual" : "none",
      },
    });
    if (!created) {
      return {
        episodeId: storedId,
        created: false,
        cueCount: cues.length,
        translationSource: translated ? "manual" : "none",
        translationPending: false,
      };
    }

    try {
      const imported = await deps.subtitles.importSubtitles({
        userId: input.userId,
        episodeId,
        target: {
          language: input.pair.target,
          upload: { filename: `${slug}.srt`, bytes: encoder.encode(cuesToSrt(cues)) },
        },
        native: translated
          ? {
              language: input.pair.native,
              upload: { filename: `${slug}.translation.srt`, bytes: encoder.encode(cuesToSrt(translated)) },
            }
          : undefined,
      });
      return {
        episodeId,
        created: true,
        cueCount: imported.cueCount,
        translationSource: translated ? "manual" : "none",
        translationPending: !translated && input.translateWithAi && input.pair.native !== input.pair.target,
      };
    } catch (error) {
      await deps.music.removeSong(episodeId);
      throw error;
    }
  };
}
