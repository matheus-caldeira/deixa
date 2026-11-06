import type { Clock } from "@/shared/clock";
import { AppError } from "@/shared/errors";
import type { IdGenerator } from "@/shared/ids";
import type { StudyLanguage } from "@/shared/study-languages";
import {
  MAX_PLAYLISTS_PER_USER,
  MAX_PLAYLIST_TITLE,
  playlistExternalId,
  type Playlist,
} from "../domain/music";
import type { MusicRepository } from "./ports";

export function makeCreatePlaylist(deps: { music: MusicRepository; clock: Clock; ids: IdGenerator }) {
  return async function createPlaylist(input: {
    userId: string;
    title: string;
    language: StudyLanguage;
  }): Promise<Playlist> {
    const title = input.title.replace(/\s+/g, " ").trim();
    if (title.length === 0 || title.length > MAX_PLAYLIST_TITLE) throw new AppError("INVALID_INPUT");
    if ((await deps.music.countPlaylistsBy(input.userId)) >= MAX_PLAYLISTS_PER_USER) {
      throw new AppError("INVALID_INPUT", {
        key: "tooManyPlaylists",
        params: { max: MAX_PLAYLISTS_PER_USER },
      });
    }
    const id = deps.ids.next();
    return deps.music.ensurePlaylist({
      id,
      seasonId: deps.ids.next(),
      externalId: playlistExternalId(id),
      title,
      overview: "",
      language: input.language,
      createdBy: input.userId,
      now: deps.clock.now(),
    });
  };
}
