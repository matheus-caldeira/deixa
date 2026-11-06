import { AppError } from "@/shared/errors";
import { canEditPlaylist, type Actor, type Playlist, type SongEntry } from "../domain/music";
import type { MusicRepository } from "./ports";

export type PlaylistView = { playlist: Playlist; songs: SongEntry[]; canEdit: boolean };

export function makeGetPlaylist(deps: { music: MusicRepository }) {
  return async function getPlaylist(input: Actor & { playlistId: string }): Promise<PlaylistView> {
    const playlist = await deps.music.findPlaylist(input.playlistId);
    if (!playlist) throw new AppError("MEDIA_NOT_FOUND");
    const songs = await deps.music.listSongs(input.playlistId);
    return { playlist, songs, canEdit: canEditPlaylist(playlist, input) };
  };
}
