import { readFileSync } from "node:fs";
import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/infrastructure/database/client";
import { episodeLevelMeasurements, episodes } from "@/infrastructure/database/schema";
import { openTestDatabase, testDatabaseAvailable } from "@/infrastructure/database/test-database";
import { parseSrt } from "@/modules/subtitles";
import { FixedClock } from "@/shared/clock";
import { posterColorsFor, type MetadataSource } from "../domain/catalog";
import { makeGetWorkLevelRatings, type LevelSourceRepository } from "../application/level-sources";
import { makeMeasureEpisodeLevel } from "../application/measure-episode-level";
import { DrizzleAiLevelRatingRepository } from "./drizzle-ai-level-rating-repository";
import { DrizzleCatalogRepository } from "./drizzle-catalog-repository";
import { DrizzleEpisodeLevelRepository } from "./drizzle-episode-level-repository";

const TEST_DATABASE = "deixa_test_episode_level";
const CREATED = new Date("2026-11-01T00:00:00Z");
const sampleCues = parseSrt(readFileSync("fixtures/sample.en.srt", "utf8")).cues;

const noSources: LevelSourceRepository = {
  list: async () => [],
  find: async () => null,
  findByUrl: async () => null,
  add: async () => undefined,
  remove: async () => undefined,
  removeChildrenExcept: async () => undefined,
  setEnabled: async () => undefined,
  saveRatings: async () => undefined,
  saveFailure: async () => undefined,
  ratingsFor: async () => new Map(),
  ratedIds: async () => [],
};

describe.skipIf(!testDatabaseAvailable)("nível medido pelas falas no banco", () => {
  let handle: DatabaseHandle;
  let catalog: DrizzleCatalogRepository;
  let measured: DrizzleEpisodeLevelRepository;

  beforeAll(async () => {
    handle = await openTestDatabase(TEST_DATABASE);
    catalog = new DrizzleCatalogRepository(handle.db);
    measured = new DrizzleEpisodeLevelRepository(handle.db);
  });

  afterAll(async () => {
    await handle?.close();
  });

  async function readyEpisode(provider: MetadataSource, externalId: string, mediaId: string) {
    const id = await catalog.upsertMedia({
      id: mediaId,
      type: "series",
      title: "Obra fictícia",
      originalTitle: "Fictional Show",
      overview: "",
      year: 2020,
      metadataProvider: provider,
      externalId,
      posterPath: null,
      backdropPath: null,
      posterColors: posterColorsFor(externalId),
      levelMin: "C1",
      levelMax: "C2",
      accent: null,
      originalLanguage: "en",
      createdBy: null,
      syncedAt: null,
      createdAt: CREATED,
    });
    const seasonId = crypto.randomUUID();
    await catalog.upsertSeasons(id, [{ id: seasonId, seasonNumber: 1, title: "T1", episodeCount: 1 }]);
    const [season] = await catalog.listSeasons(id);
    await catalog.upsertEpisodes(
      season?.id ?? seasonId,
      [
        {
          id: crypto.randomUUID(),
          episodeNumber: 1,
          title: "Piloto",
          overview: "",
          durationSeconds: null,
          stillPath: null,
        },
      ],
      null,
    );
    const [episode] = await catalog.listEpisodes(season?.id ?? seasonId);
    if (!episode) throw new Error("episódio esperado");
    await handle.db.update(episodes).set({ status: "READY" }).where(eq(episodes.id, episode.id));
    return { mediaId: id, episodeId: episode.id };
  }

  it("mede uma vez por episódio, entra na faixa da obra e só vale para obras do TMDB", async () => {
    const tmdb = await readyEpisode("tmdb", "tv:9001", crypto.randomUUID());
    const local = await readyEpisode("fake", "suits", crypto.randomUUID());
    const deps = {
      catalog,
      measured,
      sources: noSources,
      builtin: { count: 0, ids: () => [], rangeOf: () => null },
      aiRatings: new DrizzleAiLevelRatingRepository(handle.db),
      clock: new FixedClock("2026-11-03T12:00:00Z"),
      readCues: async () => sampleCues,
    };
    const measure = makeMeasureEpisodeLevel(deps);

    expect(await measure({ episodeId: tmdb.episodeId, language: "en" })).toEqual({
      status: "measured",
      level: "B1",
      rangeUpdated: true,
    });
    await measure({ episodeId: tmdb.episodeId, language: "en" });
    await measure({ episodeId: local.episodeId, language: "en" });

    const [rows] = await handle.db.select({ total: count() }).from(episodeLevelMeasurements);
    expect(rows?.total).toBe(2);
    expect(await measured.levelsFor(["tv:9001", "suits"])).toEqual(new Map([["tv:9001", ["B1"]]]));
    expect(await catalog.findMediaById(tmdb.mediaId)).toMatchObject({ levelMin: "B1", levelMax: "B1" });
    expect(await catalog.findMediaById(local.mediaId)).toMatchObject({ levelMin: "C1", levelMax: "C2" });

    const ratings = await makeGetWorkLevelRatings(deps)({ mediaId: tmdb.mediaId });
    expect(ratings).toEqual({
      range: ["B1", "B1"],
      ratings: [{ kind: "measured", sourceId: null, sourceName: null, range: ["B1", "B1"], episodes: 1 }],
    });

    await handle.db.delete(episodes).where(eq(episodes.id, tmdb.episodeId));
    expect(await measured.levelsFor(["tv:9001"])).toEqual(new Map());
  });
});
