import { z } from "zod";
import { pairOf } from "@/modules/identity";
import { MAX_PLAYLIST_TITLE, MAX_SONG_FIELD, songTimingSchema, type LyricsInput } from "@/modules/music";
import { MAX_LRC_CHARS } from "@/modules/music";
import { operation } from "./operation";
import type { LyricsCandidateView } from "./views";

const idSchema = z.uuid();
const MAX_URL_CHARS = 300;
const MAX_QUERY_CHARS = 120;
const MAX_TRANSLATION_CHARS = 100_000;

export const searchLyricsSchema = z.object({
  query: z.string().max(MAX_QUERY_CHARS).optional(),
  artist: z.string().max(MAX_QUERY_CHARS).optional(),
  title: z.string().max(MAX_QUERY_CHARS).optional(),
});

export const addSongSchema = z
  .object({
    playlistId: idSchema,
    videoUrl: z.string().max(MAX_URL_CHARS),
    artist: z.string().max(MAX_SONG_FIELD),
    title: z.string().max(MAX_SONG_FIELD),
    lyricsId: z.string().min(1).max(40).optional(),
    lrc: z.string().max(MAX_LRC_CHARS).optional(),
    translationText: z.string().max(MAX_TRANSLATION_CHARS).optional(),
    translateWithAi: z.boolean().default(true),
  })
  .refine((input) => Boolean(input.lyricsId) !== Boolean(input.lrc?.trim()));

const timingInput = songTimingSchema.extend({ episodeId: idSchema });

function lyricsOf(input: z.infer<typeof addSongSchema>): LyricsInput {
  return input.lyricsId
    ? { kind: "provider", lyricsId: input.lyricsId }
    : { kind: "lrc", text: input.lrc ?? "" };
}

export const musicOperations = {
  "music.ensureDefault": operation({
    input: z.undefined(),
    refresh: true,
    run: async ({ user, app }) => {
      const playlist = await app.ensureDefaultPlaylist({
        userId: user.id,
        language: pairOf(user.preferences).target,
      });
      return { playlistId: playlist.id };
    },
  }),
  "music.createPlaylist": operation({
    input: z.object({ title: z.string().max(MAX_PLAYLIST_TITLE * 2) }),
    refresh: true,
    run: async ({ user, app }, input) => {
      const playlist = await app.createPlaylist({
        userId: user.id,
        title: input.title,
        language: pairOf(user.preferences).target,
      });
      return { playlistId: playlist.id };
    },
  }),
  "music.searchLyrics": operation({
    input: searchLyricsSchema,
    run: async ({ app }, input): Promise<LyricsCandidateView[]> => app.searchLyrics(input),
  }),
  "music.addSong": operation({
    input: addSongSchema,
    refresh: true,
    run: async ({ user, app, schedule }, input) => {
      const pair = pairOf(user.preferences);
      const result = await app.addSong({
        userId: user.id,
        isAdmin: user.isAdmin,
        playlistId: input.playlistId,
        videoUrl: input.videoUrl,
        artist: input.artist,
        title: input.title,
        pair,
        lyrics: lyricsOf(input),
        translationText: input.translationText,
        translateWithAi: input.translateWithAi,
      });
      if (result.translationPending) {
        await schedule("music_translate", { userId: user.id, episodeId: result.episodeId, pair });
      }
      return result;
    },
  }),
  "music.removeSong": operation({
    input: z.object({ episodeId: idSchema }),
    refresh: true,
    run: async ({ user, app }, input) =>
      app.removeSong({ userId: user.id, isAdmin: user.isAdmin, episodeId: input.episodeId }),
  }),
  "music.saveTiming": operation({
    input: timingInput,
    refresh: true,
    run: async ({ user, app }, input) =>
      app.updateSongTiming({
        userId: user.id,
        isAdmin: user.isAdmin,
        episodeId: input.episodeId,
        timing: { leadInMs: input.leadInMs, pauses: input.pauses },
      }),
  }),
  "music.requestTranslation": operation({
    input: z.object({ episodeId: idSchema }),
    refresh: true,
    run: async ({ user, app, schedule }, input) => {
      const pair = pairOf(user.preferences);
      const { schedule: needed } = await app.requestSongTranslation({
        userId: user.id,
        isAdmin: user.isAdmin,
        episodeId: input.episodeId,
        pair,
      });
      if (!needed) return { scheduled: false };
      if (!(await app.hasPendingJob("music_translate", { episodeId: input.episodeId }))) {
        await schedule("music_translate", { userId: user.id, episodeId: input.episodeId, pair });
      }
      return { scheduled: true };
    },
  }),
};
