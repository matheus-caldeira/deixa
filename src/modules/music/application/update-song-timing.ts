import type { Actor } from "../domain/music";
import { normalizePauses, songTimingSchema, type SongTiming } from "../domain/timeline";
import { loadEditableSong } from "./access";
import type { MusicRepository } from "./ports";

export function makeUpdateSongTiming(deps: { music: MusicRepository }) {
  return async function updateSongTiming(
    input: Actor & { episodeId: string; timing: SongTiming },
  ): Promise<SongTiming> {
    await loadEditableSong(deps.music, input.episodeId, input);
    const parsed = songTimingSchema.parse(input.timing);
    const timing = { leadInMs: parsed.leadInMs, pauses: normalizePauses(parsed.pauses) };
    await deps.music.updateTiming(input.episodeId, timing);
    return timing;
  };
}
