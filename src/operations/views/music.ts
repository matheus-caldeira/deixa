import { z } from "zod";
import { pairOf } from "@/modules/identity";
import { youtubeThumbnailUrl } from "@/modules/music";
import { AppError } from "@/shared/errors";
import { defaultDisplayMode } from "@/shared/levels";
import { routes } from "@/shared/routes";
import { operation } from "../operation";
import type { ListenPageView, MusicHomeView, PlaylistPageView } from "../views";

export const dynamic = "force-dynamic";

export const musicViews = {
  "view.music": operation({
    input: z.undefined(),
    run: async ({ user, app }): Promise<MusicHomeView> => {
      const defaultPlaylist = await app.ensureDefaultPlaylist({
        userId: user.id,
        language: pairOf(user.preferences).target,
      });
      const playlists = await app.listPlaylists({ userId: user.id });
      return {
        defaultPlaylistId: defaultPlaylist.id,
        lyricsProvider: app.providers.lyrics,
        playlists: playlists.map((playlist) => ({
          id: playlist.id,
          title: playlist.title,
          songCount: playlist.songCount,
          owned: playlist.owned,
          creatorName: playlist.createdByName,
          href: routes.playlist(playlist.id),
        })),
      };
    },
  }),
  "view.playlist": operation({
    input: z.object({ id: z.string().optional() }),
    run: async ({ user, app }, input): Promise<PlaylistPageView> => {
      const parsed = z.uuid().safeParse(input.id);
      if (!parsed.success) throw new AppError("MEDIA_NOT_FOUND");
      const pair = pairOf(user.preferences);
      const view = await app.getPlaylist({
        userId: user.id,
        isAdmin: user.isAdmin,
        playlistId: parsed.data,
      });
      return {
        id: view.playlist.id,
        title: view.playlist.title,
        canEdit: view.canEdit,
        backHref: routes.music(),
        pair,
        lyricsProvider: app.providers.lyrics,
        songs: view.songs.map((song) => ({
          episodeId: song.episodeId,
          number: song.episodeNumber,
          artist: song.artist,
          title: song.trackTitle,
          youtubeVideoId: song.youtubeVideoId,
          thumbnailUrl: youtubeThumbnailUrl(song.youtubeVideoId),
          status: song.status,
          cueCount: song.cueCount,
          durationMs: song.durationMs,
          hasTranslation: song.subtitleLanguages.includes(pair.native),
          translationSource: song.translationSource,
          listenHref: routes.listen(song.episodeId),
          readHref: song.status === "READY" ? routes.read(song.episodeId) : null,
        })),
      };
    },
  }),
  "view.listen": operation({
    input: z.object({ episode: z.string().optional() }),
    run: async ({ user, app }, input): Promise<ListenPageView> => {
      const parsed = z.uuid().safeParse(input.episode);
      if (!parsed.success) throw new AppError("EPISODE_NOT_FOUND");
      const player = await app.getSongPlayer({
        userId: user.id,
        isAdmin: user.isAdmin,
        episodeId: parsed.data,
        pair: pairOf(user.preferences),
      });
      return {
        ...player,
        backHref: routes.playlist(player.playlistId),
        readHref: routes.read(player.episodeId),
        defaultMode: defaultDisplayMode(user.preferences.level),
      };
    },
  }),
};
