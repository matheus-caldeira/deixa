import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/infrastructure/database/client";
import { episodes, mediaItems, users } from "@/infrastructure/database/schema";
import { openTestDatabase, testDatabaseAvailable } from "@/infrastructure/database/test-database";
import { DrizzleMusicRepository } from "./drizzle-music-repository";

const TEST_DATABASE = "deixa_test_music";
const NOW = new Date("2026-11-06T12:00:00Z");

describe.skipIf(!testDatabaseAvailable)("playlists e músicas no banco", () => {
  let handle: DatabaseHandle;
  let music: DrizzleMusicRepository;
  const owner = crypto.randomUUID();

  beforeAll(async () => {
    handle = await openTestDatabase(TEST_DATABASE);
    music = new DrizzleMusicRepository(handle.db);
    await handle.db.insert(users).values({
      id: owner,
      email: "dono@example.test",
      name: "Dono",
      passwordHash: "x",
      avatarColor: "#123456",
      isAdmin: false,
      createdAt: NOW,
    });
  });

  afterAll(async () => {
    await handle?.close();
  });

  function playlistInput(externalId: string) {
    return {
      id: crypto.randomUUID(),
      seasonId: crypto.randomUUID(),
      externalId,
      title: "Minhas músicas",
      overview: "",
      language: "en" as const,
      createdBy: owner,
      now: NOW,
    };
  }

  function songInput(playlistId: string, videoId: string) {
    return {
      playlistId,
      episodeId: crypto.randomUUID(),
      title: `Faixa ${videoId}`,
      overview: "Artista fictício",
      now: NOW,
      song: {
        youtubeVideoId: videoId,
        artist: "Artista fictício",
        trackTitle: `Faixa ${videoId}`,
        durationMs: 52_000,
        leadInMs: 0,
        pauses: [],
        lyricsSource: "fake" as const,
        lyricsExternalId: "fake-1",
        translationSource: "none" as const,
      },
    };
  }

  it("cria a playlist uma vez por chave e a lista como obra de música", async () => {
    const first = await music.ensurePlaylist(playlistInput("playlist:default-a"));
    const second = await music.ensurePlaylist(playlistInput("playlist:default-a"));
    expect(second.id).toBe(first.id);
    expect(first).toMatchObject({ createdBy: owner, createdByName: "Dono", songCount: 0 });
    const [media] = await handle.db.select().from(mediaItems).where(eq(mediaItems.id, first.id));
    expect(media).toMatchObject({ type: "music", metadataProvider: "manual" });
    expect((await music.listPlaylists()).some((playlist) => playlist.id === first.id)).toBe(true);
    expect(await music.countPlaylistsBy(owner)).toBeGreaterThan(0);
  });

  it("numera as músicas e não duplica o mesmo vídeo", async () => {
    const playlist = await music.ensurePlaylist(playlistInput("playlist:songs"));
    const a = await music.createSong(songInput(playlist.id, "AAAAAAAAAAA"));
    const b = await music.createSong(songInput(playlist.id, "BBBBBBBBBBB"));
    const again = await music.createSong(songInput(playlist.id, "AAAAAAAAAAA"));
    expect(a.created && b.created).toBe(true);
    expect(again).toEqual({ episodeId: a.episodeId, created: false });
    const songs = await music.listSongs(playlist.id);
    expect(songs.map((song) => [song.episodeNumber, song.youtubeVideoId, song.status])).toEqual([
      [1, "AAAAAAAAAAA", "NONE"],
      [2, "BBBBBBBBBBB", "NONE"],
    ]);
    const orphans = await handle.db.select().from(episodes).where(eq(episodes.id, again.episodeId));
    expect(orphans).toHaveLength(1);
    expect((await music.findPlaylist(playlist.id))?.songCount).toBe(2);
  });

  it("atualiza tempo e origem da tradução e remove em cascata", async () => {
    const playlist = await music.ensurePlaylist(playlistInput("playlist:edit"));
    const { episodeId } = await music.createSong(songInput(playlist.id, "CCCCCCCCCCC"));
    await music.updateTiming(episodeId, { leadInMs: 8000, pauses: [{ atMs: 30_000, durationMs: 2000 }] });
    await music.updateTranslationSource(episodeId, "llm");
    const found = await music.findSong(episodeId);
    expect(found).toMatchObject({
      leadInMs: 8000,
      pauses: [{ atMs: 30_000, durationMs: 2000 }],
      translationSource: "llm",
      playlist: { id: playlist.id },
    });
    expect(await music.listTracks(playlist.id)).toHaveLength(1);
    await music.removeSong(episodeId);
    expect(await music.findSong(episodeId)).toBeNull();
    expect(await music.listTracks(playlist.id)).toHaveLength(0);
  });

  it("grava faixa vinda de pacote sem duplicar", async () => {
    const playlist = await music.ensurePlaylist(playlistInput("playlist:package"));
    const input = songInput(playlist.id, "DDDDDDDDDDD");
    await music.createSong(input);
    const [track] = await music.listTracks(playlist.id);
    if (!track) throw new Error("faixa ausente");
    await music.upsertTrack(track);
    expect(await music.listTracks(playlist.id)).toHaveLength(1);
  });

  it("outra conta não é dona da playlist", async () => {
    const playlist = await music.ensurePlaylist(playlistInput("playlist:owner"));
    expect(playlist.createdBy).toBe(owner);
    expect(await music.countPlaylistsBy(crypto.randomUUID())).toBe(0);
  });
});
