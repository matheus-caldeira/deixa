import { beforeEach, describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { isAppError } from "@/shared/errors";
import { SequentialIds } from "@/shared/ids";
import { posterColorsFor } from "../domain/catalog";
import { aggregateLevelRanges, parseLevelSourceDocument, type LevelRange } from "../domain/level-ratings";
import {
  levelRatingsFile,
  makeAddLevelSource,
  makeGetWorkLevelRatings,
  makeListLevelSources,
  makeRemoveLevelSource,
  makeSetLevelSourceEnabled,
  makeSyncLevelSources,
  type LevelFetchFailure,
  type LevelFetchResult,
  type LevelRating,
  type LevelSource,
  type LevelSourceRepository,
} from "./level-sources";
import { InMemoryAiLevelRatings, InMemoryEpisodeLevels, InMemoryCatalog } from "./testing/fakes";

const ADMIN = { userId: "admin", isAdmin: true };
const PERSON = { userId: "ana", isAdmin: false };
const ROOT = "https://niveis.example/indice.json";
const CHILD = "https://outra.example/series.json";
const GRANDCHILD = "https://terceira.example/filmes.json";
const TOO_DEEP = "https://quarta.example/funda.json";

class InMemoryLevelSources implements LevelSourceRepository {
  readonly sources: LevelSource[] = [];
  readonly ratings = new Map<string, Map<string, LevelRange>>();

  async list() {
    return [...this.sources];
  }
  async find(id: string) {
    return this.sources.find((source) => source.id === id) ?? null;
  }
  async findByUrl(url: string) {
    return this.sources.find((source) => source.url === url) ?? null;
  }
  async add(input: { id: string; url: string; parentId: string | null; now: Date }) {
    this.sources.push({
      id: input.id,
      url: input.url,
      name: null,
      parentId: input.parentId,
      enabled: true,
      status: "PENDING",
      ratingCount: 0,
      rejectedCount: 0,
      lastError: null,
      lastStatus: null,
      fetchedAt: null,
      createdAt: input.now,
    });
  }
  async remove(id: string) {
    const doomed = new Set([id]);
    for (let round = 0; round < 3; round += 1) {
      for (const source of this.sources)
        if (source.parentId && doomed.has(source.parentId)) doomed.add(source.id);
    }
    for (const sourceId of doomed) this.ratings.delete(sourceId);
    this.sources.splice(0, this.sources.length, ...this.sources.filter((source) => !doomed.has(source.id)));
  }
  async removeChildrenExcept(parentId: string, urls: readonly string[]) {
    for (const source of this.sources.filter(
      (item) => item.parentId === parentId && !urls.includes(item.url),
    )) {
      await this.remove(source.id);
    }
  }
  async setEnabled(id: string, enabled: boolean) {
    const source = await this.find(id);
    if (source) source.enabled = enabled;
  }
  async saveRatings(
    id: string,
    result: { name: string | null; ratings: ReadonlyMap<string, LevelRange>; rejected: number; now: Date },
  ) {
    this.ratings.set(id, new Map(result.ratings));
    const source = await this.find(id);
    if (source) {
      Object.assign(source, {
        name: result.name,
        status: "READY",
        ratingCount: result.ratings.size,
        rejectedCount: result.rejected,
        lastError: null,
        fetchedAt: result.now,
      });
    }
  }
  async saveFailure(id: string, failure: { reason: LevelFetchFailure; status: number | null; now: Date }) {
    const source = await this.find(id);
    if (source)
      Object.assign(source, { status: "FAILED", lastError: failure.reason, lastStatus: failure.status });
  }
  async ratedIds() {
    const ids = new Set<string>();
    for (const source of this.sources) {
      if (!source.enabled || source.status !== "READY") continue;
      for (const externalId of this.ratings.get(source.id)?.keys() ?? []) ids.add(externalId);
    }
    return [...ids];
  }
  async ratingsFor(externalIds: readonly string[]) {
    const found = new Map<string, LevelRating[]>();
    for (const source of this.sources) {
      if (!source.enabled || source.status !== "READY") continue;
      for (const [externalId, range] of this.ratings.get(source.id) ?? []) {
        if (!externalIds.includes(externalId)) continue;
        found.set(externalId, [
          ...(found.get(externalId) ?? []),
          { kind: "source" as const, sourceId: source.id, sourceName: source.name, range },
        ]);
      }
    }
    return found;
  }
}

function setup() {
  const sources = new InMemoryLevelSources();
  const catalog = new InMemoryCatalog();
  const clock = new FixedClock("2026-10-20T12:00:00Z");
  const responses = new Map<string, LevelFetchResult>();
  const fetched: string[] = [];
  const deps = {
    sources,
    catalog,
    clock,
    ids: new SequentialIds("ls"),
    aiRatings: new InMemoryAiLevelRatings(),
    measured: new InMemoryEpisodeLevels(catalog),
    builtin: {
      count: 1,
      ids: () => ["tv:1668"],
      rangeOf: (externalId: string): LevelRange | null => (externalId === "tv:1668" ? ["B1", "B2"] : null),
    },
    fetcher: {
      fetchJson: async (url: string): Promise<LevelFetchResult> => {
        fetched.push(url);
        return responses.get(url) ?? { ok: false, reason: "status", status: 404 };
      },
    },
  };
  return {
    sources,
    catalog,
    responses,
    fetched,
    add: makeAddLevelSource(deps),
    list: makeListLevelSources(deps),
    remove: makeRemoveLevelSource(deps),
    toggle: makeSetLevelSourceEnabled(deps),
    sync: makeSyncLevelSources(deps),
    ratingsOf: makeGetWorkLevelRatings(deps),
  };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "ok";
  } catch (error) {
    return isAppError(error) ? `${error.code}:${error.detail?.key ?? ""}` : "unexpected";
  }
}

async function addFriends(app: ReturnType<typeof setup>) {
  return app.catalog.upsertMedia({
    id: "m-friends",
    type: "series",
    title: "Friends",
    originalTitle: "Friends",
    overview: "",
    year: 1994,
    metadataProvider: "tmdb",
    externalId: "tv:1668",
    posterPath: null,
    backdropPath: null,
    posterColors: posterColorsFor("Friends"),
    levelMin: "A1",
    levelMax: "A1",
    accent: null,
    originalLanguage: "en",
    createdBy: null,
    syncedAt: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
  });
}

describe("arquivo de fonte de nível", () => {
  it("lê avaliações, nome e outras URLs, e conta o que foi recusado", () => {
    const document = parseLevelSourceDocument({
      name: "  Clube de inglês ",
      ratings: {
        "tv:1668": "b1-b2",
        "movie:550": "C1",
        "tv:1": { min: "A2", max: "B1" },
        friends: "B1",
        "tv:2": "Z9",
      },
      sources: [CHILD, CHILD, "ftp://x.example/a.json", "https://user:senha@x.example/a.json"],
    });
    expect(document?.name).toBe("Clube de inglês");
    expect(Object.fromEntries(document?.ratings ?? [])).toEqual({
      "tv:1668": ["B1", "B2"],
      "movie:550": ["C1", "C1"],
      "tv:1": ["A2", "B1"],
    });
    expect(document?.sources).toEqual([CHILD]);
    expect(document?.rejected).toBe(4);
    expect(parseLevelSourceDocument({ "tv:1668": "B2-B1" })?.ratings.size).toBe(0);
    expect(parseLevelSourceDocument([1, 2])).toBeNull();
    expect(parseLevelSourceDocument({ ratings: "nada" })).toBeNull();
  });

  it("junta várias avaliações pela mediana, sem mínimo acima do máximo", () => {
    expect(aggregateLevelRanges([])).toBeNull();
    expect(aggregateLevelRanges([["B1", "B2"]])).toEqual(["B1", "B2"]);
    expect(
      aggregateLevelRanges([
        ["A2", "B1"],
        ["B1", "B2"],
        ["C1", "C2"],
      ]),
    ).toEqual(["B1", "B2"]);
    expect(
      aggregateLevelRanges([
        ["A2", "A2"],
        ["B2", "B2"],
      ]),
    ).toEqual(["A2", "B2"]);
    expect(
      aggregateLevelRanges([
        ["C1", "C1"],
        ["C1", "C1"],
        ["A1", "A1"],
      ]),
    ).toEqual(["C1", "C1"]);
  });
});

describe("fontes de nível", () => {
  let app: ReturnType<typeof setup>;

  beforeEach(() => {
    app = setup();
  });

  it("só o administrador vê e altera as fontes; URL inválida ou repetida é recusada", async () => {
    expect(await codeOf(app.list({ actor: PERSON }))).toBe("FORBIDDEN:adminOnlyLevelSources");
    expect(await codeOf(app.add({ actor: PERSON, url: ROOT }))).toBe("FORBIDDEN:adminOnlyLevelSources");
    expect(await codeOf(app.add({ actor: ADMIN, url: "javascript:alert(1)" }))).toBe(
      "INVALID_INPUT:levelSourceUrlInvalid",
    );
    await app.add({ actor: ADMIN, url: ROOT });
    expect(await codeOf(app.add({ actor: ADMIN, url: ` ${ROOT} ` }))).toBe("INVALID_INPUT:levelSourceExists");
    expect(await app.list({ actor: ADMIN })).toMatchObject({ builtinCount: 1, sources: [{ url: ROOT }] });
  });

  it("baixa a URL, segue as URLs listadas até dois níveis e recalcula a faixa das obras", async () => {
    await addFriends(app);
    await app.add({ actor: ADMIN, url: ROOT });
    app.responses.set(ROOT, {
      ok: true,
      data: { name: "Índice", ratings: { "tv:1668": "B2-C1" }, sources: [CHILD] },
    });
    app.responses.set(CHILD, { ok: true, data: { ratings: { "tv:1668": "C1-C2" }, sources: [GRANDCHILD] } });
    app.responses.set(GRANDCHILD, { ok: true, data: { ratings: { "tv:1668": "B2" }, sources: [TOO_DEEP] } });

    expect(await app.sync({ sourceId: null })).toEqual({ fetched: 3, failed: 0, updated: 1 });
    expect(app.fetched).toEqual([ROOT, CHILD, GRANDCHILD]);
    expect(app.sources.sources.map((source) => [source.url, source.status])).toEqual([
      [ROOT, "READY"],
      [CHILD, "READY"],
      [GRANDCHILD, "READY"],
    ]);
    const ratings = await app.ratingsOf({ mediaId: "m-friends" });
    expect(ratings.ratings.map((rating) => rating.range)).toEqual([
      ["B1", "B2"],
      ["B2", "C1"],
      ["C1", "C2"],
      ["B2", "B2"],
    ]);
    expect(ratings.range).toEqual(["B2", "C1"]);
    expect(await app.catalog.findMediaById("m-friends")).toMatchObject({ levelMin: "B2", levelMax: "C1" });

    app.responses.set(ROOT, { ok: true, data: { ratings: { "tv:1668": "B2-C1" } } });
    await app.sync({ sourceId: null });
    expect(app.sources.sources.map((source) => source.url)).toEqual([ROOT]);
    expect(await app.catalog.findMediaById("m-friends")).toMatchObject({ levelMin: "B1", levelMax: "C1" });
  });

  it("fonte fora do ar fica com falha e não muda a faixa; desligar ou remover volta ao guia", async () => {
    await addFriends(app);
    const { sourceId } = await app.add({ actor: ADMIN, url: ROOT });
    expect(await app.sync({ sourceId })).toEqual({ fetched: 0, failed: 1, updated: 1 });
    expect(app.sources.sources[0]).toMatchObject({ status: "FAILED", lastError: "status", lastStatus: 404 });
    expect(await app.catalog.findMediaById("m-friends")).toMatchObject({ levelMin: "B1", levelMax: "B2" });

    app.responses.set(ROOT, { ok: true, data: { ratings: { "tv:1668": "C2" }, sources: [CHILD] } });
    app.responses.set(CHILD, { ok: true, data: { "tv:1668": "C2" } });
    await app.sync({ sourceId });
    expect(await app.catalog.findMediaById("m-friends")).toMatchObject({ levelMin: "C2", levelMax: "C2" });

    await app.toggle({ actor: ADMIN, sourceId, enabled: false });
    expect(app.sources.sources.every((source) => !source.enabled)).toBe(true);
    expect(await app.catalog.findMediaById("m-friends")).toMatchObject({ levelMin: "B1", levelMax: "B2" });

    const child = app.sources.sources.find((source) => source.url === CHILD);
    expect(await codeOf(app.remove({ actor: ADMIN, sourceId: child?.id ?? "" }))).toBe(
      "INVALID_INPUT:levelSourceChild",
    );
    await app.remove({ actor: ADMIN, sourceId });
    expect(app.sources.sources).toEqual([]);
  });
});

describe("arquivo da exportação de níveis", () => {
  it("nomeia pelo app e pelo dia e fecha o JSON com quebra de linha", () => {
    const file = levelRatingsFile({
      name: "Deixa",
      exportedAt: "2026-11-03T12:30:00.000Z",
      count: 1,
      ratings: { "tv:1": "A2-B1" },
      ai: {},
    });
    expect(file.filename).toBe("deixa-niveis-2026-11-03.json");
    expect(file.contents.endsWith("}\n")).toBe(true);
    expect(JSON.parse(file.contents)).toMatchObject({ count: 1, ratings: { "tv:1": "A2-B1" } });
  });
});
