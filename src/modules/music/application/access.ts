import { AppError } from "@/shared/errors";
import { canEditPlaylist, type Actor, type Playlist } from "../domain/music";
import type { MusicRepository } from "./ports";

export async function loadEditablePlaylist(
  music: MusicRepository,
  playlistId: string,
  actor: Actor,
): Promise<Playlist> {
  const playlist = await music.findPlaylist(playlistId);
  if (!playlist) throw new AppError("MEDIA_NOT_FOUND");
  if (!canEditPlaylist(playlist, actor)) throw new AppError("FORBIDDEN");
  return playlist;
}

export async function loadEditableSong(music: MusicRepository, episodeId: string, actor: Actor) {
  const song = await music.findSong(episodeId);
  if (!song) throw new AppError("EPISODE_NOT_FOUND");
  if (!canEditPlaylist(song.playlist, actor)) throw new AppError("FORBIDDEN");
  return song;
}
