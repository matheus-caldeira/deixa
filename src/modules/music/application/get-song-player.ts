import { AppError } from "@/shared/errors";
import type { LanguagePair } from "@/shared/study-languages";
import { canEditPlaylist, type Actor, type SongTranslationSource } from "../domain/music";
import type { SongPause } from "../domain/timeline";
import type { MusicRepository, SongSubtitles } from "./ports";

export type PlayerCue = {
  cueId: string;
  startMs: number;
  endMs: number;
  text: string;
  translation: string | null;
};

export type SongPlayer = {
  episodeId: string;
  playlistId: string;
  playlistTitle: string;
  canEdit: boolean;
  youtubeVideoId: string;
  artist: string;
  title: string;
  durationMs: number | null;
  timing: { leadInMs: number; pauses: SongPause[] };
  translationSource: SongTranslationSource;
  hasNative: boolean;
  pair: LanguagePair;
  cues: PlayerCue[];
};

export function makeGetSongPlayer(deps: { music: MusicRepository; subtitles: SongSubtitles }) {
  return async function getSongPlayer(
    input: Actor & { episodeId: string; pair: LanguagePair },
  ): Promise<SongPlayer> {
    const song = await deps.music.findSong(input.episodeId);
    if (!song) throw new AppError("EPISODE_NOT_FOUND");
    if (song.status !== "READY") throw new AppError("EPISODE_NOT_READY");
    const script = await deps.subtitles.script(input.episodeId, input.pair);
    if (!script) throw new AppError("EPISODE_NOT_READY");
    return {
      episodeId: song.episodeId,
      playlistId: song.playlist.id,
      playlistTitle: song.playlist.title,
      canEdit: canEditPlaylist(song.playlist, input),
      youtubeVideoId: song.youtubeVideoId,
      artist: song.artist,
      title: song.trackTitle,
      durationMs: song.durationMs,
      timing: { leadInMs: song.leadInMs, pauses: song.pauses },
      translationSource: script.hasNative ? song.translationSource : "none",
      hasNative: script.hasNative,
      pair: input.pair,
      cues: script.lines.map((line) => ({
        cueId: line.cueId,
        startMs: line.startMs,
        endMs: line.endMs,
        text: line.text,
        translation: line.translation,
      })),
    };
  };
}
