import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/infrastructure/database/client";
import { mediaItems, songTracks, users } from "@/infrastructure/database/schema";
import { openTestDatabase, testDatabaseAvailable } from "@/infrastructure/database/test-database";
import { DrizzleAudioAssetRepository } from "@/modules/audio/infrastructure/drizzle-audio-asset-repository";
import { DrizzleCatalogRepository } from "@/modules/catalog/infrastructure/drizzle-catalog-repository";
import { DrizzleLearningRepository } from "@/modules/learning/infrastructure/drizzle-learning-repository";
import { DrizzleMusicRepository } from "@/modules/music/infrastructure/drizzle-music-repository";
import { DrizzleSubtitleRepository } from "@/modules/subtitles/infrastructure/drizzle-subtitle-repository";
import { uuidGenerator } from "@/shared/ids";
import { DrizzlePackageCatalog } from "./drizzle-package-catalog";

const TEST_DATABASE = "deixa_test_package_playlist";
const NOW = new Date("2026-11-06T12:00:00Z");
const PLAYLIST_EXTERNAL_ID = "playlist:compartilhada";

describe.skipIf(!testDatabaseAvailable)("pacote com playlist de outra conta", () => {
  let handle: DatabaseHandle;
  let packages: DrizzlePackageCatalog;
  let music: DrizzleMusicRepository;
  const owner = crypto.randomUUID();
  const intruder = crypto.randomUUID();

  beforeAll(async () => {
    handle = await openTestDatabase(TEST_DATABASE);
    const { db } = handle;
    music = new DrizzleMusicRepository(db);
    packages = new DrizzlePackageCatalog({
      db,
      catalog: new DrizzleCatalogRepository(db),
      subtitles: new DrizzleSubtitleRepository(db),
      learning: new DrizzleLearningRepository(db),
      audio: new DrizzleAudioAssetRepository(db),
      songs: music,
      importSubtitles: async () => "PROCESSED",
      ids: uuidGenerator,
      voices: [],
      modelVersion: "test",
    });
    for (const [id, name] of [
      [owner, "Dono"],
      [intruder, "Outra"],
    ] as const) {
      await db.insert(users).values({
        id,
        email: `${id}@example.test`,
        name,
        passwordHash: "x",
        avatarColor: "#123456",
        isAdmin: false,
        createdAt: NOW,
      });
    }
    await music.ensurePlaylist({
      id: crypto.randomUUID(),
      seasonId: crypto.randomUUID(),
      externalId: PLAYLIST_EXTERNAL_ID,
      title: "Minhas músicas",
      overview: "",
      language: "en",
      createdBy: owner,
      now: NOW,
    });
  });

  afterAll(async () => {
    await handle?.close();
  });

  const packagedWork = (createdBy: string) => ({
    metadataProvider: "manual" as const,
    externalId: PLAYLIST_EXTERNAL_ID,
    type: "music" as const,
    title: "Playlist do pacote",
    originalTitle: "Playlist do pacote",
    overview: "",
    year: null,
    posterPath: null,
    backdropPath: null,
    posterColors: { c1: "#111111", c2: "#222222", fg: "#ffffff" },
    levelMin: "B1" as const,
    levelMax: "B2" as const,
    accent: null,
    seasons: [{ seasonNumber: 1, title: "Músicas", episodeCount: 1 }],
    episodes: [
      {
        seasonNumber: 1,
        episodeNumber: 1,
        title: "Faixa fictícia",
        overview: "",
        durationSeconds: 60,
        stillPath: null,
        song: {
          youtubeVideoId: "aaaaaaaaaaa",
          artist: "Artista fictício",
          trackTitle: "Faixa fictícia",
          durationMs: 60_000,
          leadInMs: 0,
          pauses: [],
          lyricsSource: "fake" as const,
          lyricsExternalId: null,
          translationSource: "none" as const,
        },
      },
    ],
    createdBy,
    now: NOW,
  });

  it("cria uma playlist nova em vez de escrever na playlist de outra conta", async () => {
    const [original] = await handle.db
      .select()
      .from(mediaItems)
      .where(eq(mediaItems.externalId, PLAYLIST_EXTERNAL_ID));
    const result = await packages.ensureWork(packagedWork(intruder));
    expect(result.created).toBe(true);
    expect(result.mediaId).not.toBe(original?.id);
    expect(await music.listSongs(original!.id)).toHaveLength(0);
    const tracks = await handle.db.select().from(songTracks).where(eq(songTracks.mediaItemId, result.mediaId));
    expect(tracks).toHaveLength(1);
  });

  it("acrescenta músicas na playlist quando quem importa é o dono", async () => {
    const result = await packages.ensureWork(packagedWork(owner));
    expect(result.created).toBe(false);
    expect(await music.listSongs(result.mediaId)).toHaveLength(1);
  });
});
