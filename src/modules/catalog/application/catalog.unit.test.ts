import { beforeEach, describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { SequentialIds } from "@/shared/ids";
import {
  METADATA_MAX_AGE_DAYS,
  episodeLabel,
  isMetadataStale,
  posterColorsFor,
  posterUrl,
} from "../domain/catalog";
import { FakeMetadataProvider, fakeExternalId } from "../infrastructure/fake-metadata-provider";
import { makeGetCatalogOverview, makeGetMediaDetail, makeStartEpisode } from "./browse-catalog";
import { makeLoadSeasonEpisodes } from "./load-season-episodes";
import { makeCreateManualWork, makeEnsureManualEpisode } from "./manual-work";
import { makeRefreshWork, makeRegisterWork } from "./register-work";
import { makeSearchWorks } from "./search-works";
import { InMemoryCatalog } from "./testing/fakes";

function setup() {
  const catalog = new InMemoryCatalog();
  const metadata = new FakeMetadataProvider();
  const clock = new FixedClock("2026-10-10T12:00:00Z");
  const ids = new SequentialIds("c");
  const deps = { catalog, metadata, clock, ids, progress: catalog };
  return {
    catalog,
    metadata,
    clock,
    registerWork: makeRegisterWork(deps),
    refreshWork: makeRefreshWork(deps),
    loadSeasonEpisodes: makeLoadSeasonEpisodes(deps),
    searchWorks: makeSearchWorks(deps),
    createManualWork: makeCreateManualWork(deps),
    ensureManualEpisode: makeEnsureManualEpisode(deps),
    getCatalogOverview: makeGetCatalogOverview(deps),
    getMediaDetail: makeGetMediaDetail(deps),
    startEpisode: makeStartEpisode(deps),
  };
}

describe("catálogo", () => {
  let app: ReturnType<typeof setup>;

  beforeEach(() => {
    app = setup();
  });

  it("cadastra a série com temporadas e guarda o que veio do provider", async () => {
    const { mediaId } = await app.registerWork({
      userId: "u1",
      type: "series",
      externalId: fakeExternalId("himym"),
    });
    const media = await app.catalog.findMediaById(mediaId);
    expect(media).toMatchObject({
      title: "How I Met Your Mother",
      originalTitle: "How I Met Your Mother",
      metadataProvider: "fake",
      externalId: "fake-himym",
      levelMin: "A2",
      levelMax: "B2",
      year: 2005,
    });
    expect((await app.catalog.listSeasons(mediaId)).map((season) => season.seasonNumber)).toEqual([1, 2]);
  });

  it("não chama o provider de novo para obra já cadastrada e recente", async () => {
    const first = await app.registerWork({
      userId: "u1",
      type: "series",
      externalId: fakeExternalId("friends"),
    });
    const second = await app.registerWork({
      userId: "u2",
      type: "series",
      externalId: fakeExternalId("friends"),
    });
    expect(second).toEqual({ mediaId: first.mediaId, fetched: false });
    expect(app.metadata.calls.work).toBe(1);
    expect(app.catalog.media.size).toBe(1);
  });

  it("atualiza depois de 7 dias ou quando o usuário pede", async () => {
    const { mediaId } = await app.registerWork({
      userId: "u1",
      type: "series",
      externalId: fakeExternalId("friends"),
    });
    expect(await app.refreshWork({ mediaId, force: false })).toEqual({ refreshed: false });
    expect(await app.refreshWork({ mediaId, force: true })).toEqual({ refreshed: true });
    app.clock.advanceDays(METADATA_MAX_AGE_DAYS + 1);
    expect(await app.refreshWork({ mediaId, force: false })).toEqual({ refreshed: true });
    expect(app.metadata.calls.work).toBe(3);
    expect(app.catalog.media.size).toBe(1);
  });

  it("carrega os episódios da temporada uma vez e depois lê do banco", async () => {
    const { mediaId } = await app.registerWork({
      userId: "u1",
      type: "series",
      externalId: fakeExternalId("himym"),
    });
    const first = await app.loadSeasonEpisodes({ mediaId, seasonNumber: 1 });
    const second = await app.loadSeasonEpisodes({ mediaId, seasonNumber: 1 });
    expect(first.episodes.map((episode) => episode.title)).toEqual([
      "Pilot",
      "Purple Giraffe",
      "Sweet Taste of Liberty",
      "Return of the Shirt",
      "Okay Awesome",
    ]);
    expect(second.episodes.map((episode) => episode.id)).toEqual(first.episodes.map((episode) => episode.id));
    expect(first.episodes.every((episode) => episode.status === "NONE")).toBe(true);
    expect(app.metadata.calls.season).toBe(1);
    await expect(app.loadSeasonEpisodes({ mediaId, seasonNumber: 9 })).rejects.toMatchObject({
      code: "SEASON_NOT_FOUND",
    });
  });

  it("mantém o estado do episódio quando os metadados são atualizados", async () => {
    const { mediaId } = await app.registerWork({
      userId: "u1",
      type: "series",
      externalId: fakeExternalId("himym"),
    });
    const { episodes } = await app.loadSeasonEpisodes({ mediaId, seasonNumber: 1 });
    const pilot = episodes[0];
    if (!pilot) throw new Error("episódio esperado");
    app.catalog.setEpisodeStatus(pilot.id, "READY");
    const reloaded = await app.loadSeasonEpisodes({ mediaId, seasonNumber: 1, force: true });
    expect(reloaded.episodes[0]).toMatchObject({ id: pilot.id, status: "READY" });
  });

  it("não deixa o tipo informado pelo cliente trocar ou sobrescrever uma obra do catálogo", async () => {
    const { mediaId } = await app.registerWork({
      userId: "u1",
      type: "series",
      externalId: fakeExternalId("friends"),
    });
    await expect(
      app.registerWork({ userId: "u2", type: "movie", externalId: fakeExternalId("friends"), force: true }),
    ).rejects.toMatchObject({ code: "MEDIA_NOT_FOUND" });
    await expect(
      app.registerWork({ userId: "u2", type: "series", externalId: fakeExternalId("prada") }),
    ).rejects.toMatchObject({ code: "METADATA_NOT_FOUND" });
    expect(await app.catalog.findMediaById(mediaId)).toMatchObject({ type: "series", title: "Friends" });
    expect(app.catalog.media.size).toBe(1);
  });

  it("trata filme como temporada 0 com um único episódio", async () => {
    const { mediaId } = await app.registerWork({
      userId: "u1",
      type: "movie",
      externalId: fakeExternalId("prada"),
    });
    const detail = await app.getMediaDetail("u1", mediaId);
    expect(detail.seasons).toHaveLength(1);
    expect(detail.seasons[0]).toMatchObject({ seasonNumber: 0 });
    expect(detail.seasons[0]?.episodes).toMatchObject([
      { episodeNumber: 1, title: "Filme completo", durationSeconds: 109 * 60 },
    ]);
    expect(episodeLabel("movie", 0, 1)).toBe("Filme");
    expect(episodeLabel("series", 1, 3)).toBe("T1 · E3");
  });

  it("marca na busca as obras que já estão no catálogo", async () => {
    await app.registerWork({ userId: "u1", type: "series", externalId: fakeExternalId("office") });
    const results = await app.searchWorks("the");
    const office = results.find((work) => work.title === "The Office");
    const prada = results.find((work) => work.title === "The Devil Wears Prada");
    expect(office?.catalogMediaId).toEqual(expect.any(String));
    expect(prada?.catalogMediaId).toBeNull();
    expect(await app.searchWorks(" a ")).toEqual([]);
  });

  it("permite cadastro manual quando a obra não existe no provider", async () => {
    const { mediaId } = await app.createManualWork({
      userId: "u1",
      title: " Série Caseira ",
      type: "series",
      year: 2024,
    });
    const first = await app.ensureManualEpisode({ mediaId, seasonNumber: 2, episodeNumber: 3 });
    const again = await app.ensureManualEpisode({ mediaId, seasonNumber: 2, episodeNumber: 3 });
    expect(again.episodeId).toBe(first.episodeId);
    const detail = await app.getMediaDetail("u1", mediaId);
    expect(detail.media).toMatchObject({ title: "Série Caseira", metadataProvider: "manual" });
    expect(detail.seasons[0]?.episodes[0]).toMatchObject({ episodeNumber: 3, title: "Episódio 3" });
    await expect(
      app.createManualWork({ userId: "u1", title: "  ", type: "movie", year: null }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(await app.refreshWork({ mediaId, force: true })).toEqual({ refreshed: false });
  });

  it("não cria temporada nem episódio avulso em obra que veio do provider", async () => {
    const { mediaId } = await app.registerWork({
      userId: "u1",
      type: "series",
      externalId: fakeExternalId("suits"),
    });
    const seasonsBefore = (await app.catalog.listSeasons(mediaId)).length;
    await expect(
      app.ensureManualEpisode({ mediaId, seasonNumber: 9, episodeNumber: 9 }),
    ).rejects.toMatchObject({
      code: "EPISODE_NOT_FOUND",
    });
    expect((await app.catalog.listSeasons(mediaId)).length).toBe(seasonsBefore);
    expect(app.catalog.episodes.size).toBe(0);
  });

  it("mostra o progresso só de quem está logado", async () => {
    const { mediaId } = await app.registerWork({
      userId: "u1",
      type: "series",
      externalId: fakeExternalId("himym"),
    });
    const { episodes } = await app.loadSeasonEpisodes({ mediaId, seasonNumber: 1 });
    const [pilot, second] = episodes;
    if (!pilot || !second) throw new Error("episódios esperados");
    await app.startEpisode("ana", pilot.id);
    await app.catalog.upsert("ana", pilot.id, 35);
    await app.catalog.upsert("lucas", second.id, 100);

    const ana = await app.getCatalogOverview("ana");
    const lucas = await app.getCatalogOverview("lucas");
    expect(ana.entries).toHaveLength(1);
    expect(ana.inProgress).toMatchObject([{ episodeId: pilot.id, label: "T1 · E1", progressPercent: 35 }]);
    expect(lucas.inProgress).toEqual([]);

    const detailForLucas = await app.getMediaDetail("lucas", mediaId);
    const progressSeenByLucas = detailForLucas.seasons[0]?.episodes.map((episode) => episode.progressPercent);
    expect(progressSeenByLucas).toEqual([null, 100, null, null, null]);
  });
});

describe("regras do catálogo", () => {
  it("considera vencido o que nunca sincronizou ou passou de 7 dias", () => {
    const now = new Date("2026-10-10T00:00:00Z");
    expect(isMetadataStale(null, now)).toBe(true);
    expect(isMetadataStale(new Date("2026-10-04T00:00:00Z"), now)).toBe(false);
    expect(isMetadataStale(new Date("2026-10-02T00:00:00Z"), now)).toBe(true);
  });

  it("monta a URL do pôster e escolhe cores estáveis para o pôster tipográfico", () => {
    expect(posterUrl("/abc.jpg")).toBe("https://image.tmdb.org/t/p/w342/abc.jpg");
    expect(posterUrl(null)).toBeNull();
    expect(posterColorsFor("Suits")).toEqual(posterColorsFor("Suits"));
  });
});
