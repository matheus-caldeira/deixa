import type { Actor } from "../domain/music";
import { loadEditableSong } from "./access";
import type { MusicRepository } from "./ports";

export function makeRemoveSong(deps: { music: MusicRepository }) {
  return async function removeSong(input: Actor & { episodeId: string }): Promise<{ playlistId: string }> {
    const song = await loadEditableSong(deps.music, input.episodeId, input);
    await deps.music.removeSong(input.episodeId);
    return { playlistId: song.playlist.id };
  };
}
