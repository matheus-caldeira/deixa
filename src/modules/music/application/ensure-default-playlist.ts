import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import type { StudyLanguage } from "@/shared/study-languages";
import { DEFAULT_PLAYLIST_TITLE, defaultPlaylistExternalId, type Playlist } from "../domain/music";
import type { MusicRepository } from "./ports";

export function makeEnsureDefaultPlaylist(deps: { music: MusicRepository; clock: Clock; ids: IdGenerator }) {
  return async function ensureDefaultPlaylist(input: {
    userId: string;
    language: StudyLanguage;
  }): Promise<Playlist> {
    return deps.music.ensurePlaylist({
      id: deps.ids.next(),
      seasonId: deps.ids.next(),
      externalId: defaultPlaylistExternalId(input.userId),
      title: DEFAULT_PLAYLIST_TITLE,
      overview: "",
      language: input.language,
      createdBy: input.userId,
      now: deps.clock.now(),
    });
  };
}
