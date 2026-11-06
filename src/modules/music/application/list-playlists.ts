import type { MusicRepository, PlaylistSummary } from "./ports";

export function makeListPlaylists(deps: { music: MusicRepository }) {
  return async function listPlaylists(input: { userId: string }): Promise<PlaylistSummary[]> {
    const playlists = await deps.music.listPlaylists();
    return playlists
      .map((playlist) => ({ ...playlist, owned: playlist.createdBy === input.userId }))
      .sort((a, b) => Number(b.owned) - Number(a.owned));
  };
}
