import { beforeEach, describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import type { StudyLanguage } from "@/shared/study-languages";
import { posterColorsFor } from "../domain/catalog";
import type { LevelRange } from "../domain/level-ratings";
import type { MeasurableCue } from "../domain/subtitle-level";
import { makeGetWorkLevelRatings, type LevelSourceRepository } from "./level-sources";
import { makeMeasureEpisodeLevel } from "./measure-episode-level";
import { InMemoryAiLevelRatings, InMemoryCatalog, InMemoryEpisodeLevels } from "./testing/fakes";

const WORK = "tv:9001";
const MEDIA = "media-1";
const FIRST = "episode-1";
const SECOND = "episode-2";

const emptySources: LevelSourceRepository = {
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

function cues(lines: readonly string[], repeat: number, durationMs: number): MeasurableCue[] {
  const list: MeasurableCue[] = [];
  for (let round = 0; round < repeat; round += 1) {
    for (const text of lines) {
      const startMs = list.length * (durationMs + 500);
      list.push({ startMs, endMs: startMs + durationMs, text });
    }
  }
  return list;
}

const EASY = cues(["Hi. I am Tom.", "Is it your cat?", "Yes, it is my cat.", "I like tea."], 20, 2500);
const HARD = cues(
  [
    "Considering the unprecedented circumstances, the committee's preliminary recommendations seem remarkably inconsistent with everything we negotiated",
    "Nevertheless, establishing accountability requires extraordinarily meticulous documentation and comprehensive verification procedures",
  ],
  6,
  6000,
);

async function setup() {
  const catalog = new InMemoryCatalog();
  await catalog.upsertMedia({
    id: MEDIA,
    type: "series",
    title: "Obra fictícia",
    originalTitle: "Fictional Show",
    overview: "",
    year: 2020,
    metadataProvider: "tmdb",
    externalId: WORK,
    posterPath: null,
    backdropPath: null,
    posterColors: posterColorsFor(WORK),
    levelMin: "C1",
    levelMax: "C2",
    accent: null,
    originalLanguage: "en",
    createdBy: null,
    syncedAt: null,
    createdAt: new Date("2026-11-01T00:00:00Z"),
  });
  await catalog.upsertSeasons(MEDIA, [{ id: "season-1", seasonNumber: 1, title: "T1", episodeCount: 2 }]);
  await catalog.upsertEpisodes(
    "season-1",
    [FIRST, SECOND].map((id, index) => ({
      id,
      episodeNumber: index + 1,
      title: `Episódio ${index + 1}`,
      overview: "",
      durationSeconds: null,
      stillPath: null,
    })),
    null,
  );
  catalog.setEpisodeStatus(FIRST, "READY");
  catalog.setEpisodeStatus(SECOND, "READY");
  const subtitles = new Map<string, MeasurableCue[]>([
    [FIRST, EASY],
    [SECOND, HARD],
  ]);
  let builtinRange: LevelRange | null = null;
  const deps = {
    catalog,
    sources: emptySources,
    builtin: { count: 0, ids: () => [], rangeOf: () => builtinRange },
    aiRatings: new InMemoryAiLevelRatings(),
    measured: new InMemoryEpisodeLevels(catalog),
    clock: new FixedClock("2026-11-03T12:00:00Z"),
    readCues: async (episodeId: string, language: StudyLanguage) =>
      language === "en" ? (subtitles.get(episodeId) ?? null) : null,
  };
  return {
    catalog,
    measured: deps.measured,
    subtitles,
    withBuiltin: (range: LevelRange) => {
      builtinRange = range;
    },
    measure: makeMeasureEpisodeLevel(deps),
    ratings: makeGetWorkLevelRatings(deps),
    range: () => {
      const media = catalog.media.get(MEDIA);
      return [media?.levelMin, media?.levelMax];
    },
  };
}

describe("medir o nível do episódio pelas falas", () => {
  let app: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    app = await setup();
  });

  it("grava uma medida por episódio, recalcula a faixa da obra e não duplica ao repetir", async () => {
    expect(await app.measure({ episodeId: FIRST, language: "en" })).toEqual({
      status: "measured",
      level: "A1",
      rangeUpdated: true,
    });
    expect(app.range()).toEqual(["A1", "A1"]);
    expect(await app.measure({ episodeId: FIRST, language: "en" })).toMatchObject({ rangeUpdated: false });
    expect(app.measured.rows.size).toBe(1);

    await app.measure({ episodeId: SECOND, language: "en" });
    const work = await app.ratings({ mediaId: MEDIA });
    const measured = work.ratings.find((rating) => rating.kind === "measured");
    expect(measured).toMatchObject({ episodes: 2, range: ["A1", "B2"] });
    expect(app.range()).toEqual(measured?.range);
  });

  it("entra na mediana junto das outras avaliações", async () => {
    app.withBuiltin(["B1", "B2"]);
    await app.measure({ episodeId: FIRST, language: "en" });
    const work = await app.ratings({ mediaId: MEDIA });
    expect(work.ratings.map((rating) => rating.kind)).toEqual(["builtin", "measured"]);
    expect(work.range).toEqual(["A1", "B2"]);
  });

  it("ignora episódio que não está pronto e legenda em idioma diferente do da obra", async () => {
    app.catalog.setEpisodeStatus(FIRST, "PROCESSING");
    expect(await app.measure({ episodeId: FIRST, language: "en" })).toEqual({
      status: "skipped",
      reason: "notReady",
    });
    expect(await app.measure({ episodeId: SECOND, language: "fr" })).toEqual({
      status: "skipped",
      reason: "otherLanguage",
    });
    expect(await app.measure({ episodeId: "sem-episodio", language: "en" })).toMatchObject({
      status: "skipped",
    });
    expect(app.measured.rows.size).toBe(0);
    expect(app.range()).toEqual(["C1", "C2"]);
  });

  it("legenda reenviada curta demais tira a medida antiga do episódio", async () => {
    await app.measure({ episodeId: FIRST, language: "en" });
    app.subtitles.set(FIRST, EASY.slice(0, 3));
    expect(await app.measure({ episodeId: FIRST, language: "en" })).toEqual({
      status: "skipped",
      reason: "tooShort",
    });
    expect(app.measured.rows.size).toBe(0);
    expect((await app.ratings({ mediaId: MEDIA })).ratings).toEqual([]);
  });
});
