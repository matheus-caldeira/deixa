import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { SequentialIds } from "@/shared/ids";
import { InMemoryFileStorage } from "@/shared/storage";
import { makeGetEpisodeScript } from "./get-episode-script";
import { makeImportEpisodeSubtitles, type UploadedSubtitle } from "./import-episode-subtitles";
import { InMemorySubtitles, fixedEpisodeLocations } from "./testing/fakes";

const fixture = (name: string): UploadedSubtitle => ({
  filename: name,
  bytes: new Uint8Array(readFileSync(`fixtures/${name}`)),
});
const text = (filename: string, content: string): UploadedSubtitle => ({
  filename,
  bytes: new TextEncoder().encode(content),
});

function setup() {
  const subtitles = new InMemorySubtitles();
  const storage = new InMemoryFileStorage();
  const deps = {
    subtitles,
    storage,
    clock: new FixedClock("2026-10-10T12:00:00Z"),
    ids: new SequentialIds("s"),
    findEpisodeLocation: fixedEpisodeLocations([
      { episodeId: "ep-1", mediaId: "media-1", mediaType: "series", seasonNumber: 1 },
      { episodeId: "ep-2", mediaId: "media-1", mediaType: "series", seasonNumber: 1 },
      { episodeId: "movie-ep", mediaId: "media-2", mediaType: "movie", seasonNumber: 0 },
    ]),
  };
  return {
    subtitles,
    storage,
    importSubtitles: makeImportEpisodeSubtitles(deps),
    getEpisodeScript: makeGetEpisodeScript(deps),
  };
}

describe("importação de legendas", () => {
  let app: ReturnType<typeof setup>;

  beforeEach(() => {
    app = setup();
  });

  it("processa EN + PT, alinha por tempo e publica o episódio como READY", async () => {
    const result = await app.importSubtitles({
      userId: "u1",
      episodeId: "ep-1",
      english: fixture("sample.en.srt"),
      portuguese: fixture("sample.pt-BR.srt"),
    });
    expect(result).toMatchObject({ outcome: "PROCESSED", hasPortuguese: true, cueCount: 23 });
    expect(result.alignment?.pairs).toBe(22);
    expect(Math.round((result.alignment?.rate ?? 0) * 100)).toBe(96);
    expect(result.steps.map((step) => step.key)).toEqual([
      "validate",
      "hash",
      "duplicates",
      "readTarget",
      "readNative",
      "align",
      "publish",
      "audio",
    ]);
    expect(result.steps.find((step) => step.key === "align")?.detail).toEqual({
      key: "pairs",
      params: { count: 22, percent: "96%" },
    });
    expect(app.subtitles.episodeStatus.get("ep-1")).toMatchObject({ status: "READY", cueCount: 23 });
    expect([...app.storage.files.keys()].sort()).toEqual([
      "catalog/series/media-1/seasons/1/episodes/ep-1/alignment.json",
      "catalog/series/media-1/seasons/1/episodes/ep-1/original.en.srt",
      "catalog/series/media-1/seasons/1/episodes/ep-1/original.pt-BR.srt",
    ]);
  });

  it("detecta o reenvio do mesmo arquivo e não reprocessa nada", async () => {
    const upload = {
      userId: "u1",
      episodeId: "ep-1",
      english: fixture("sample.en.srt"),
      portuguese: fixture("sample.pt-BR.srt"),
    };
    await app.importSubtitles(upload);
    const filesBefore = app.subtitles.files.size;
    const cuesBefore = [...app.subtitles.cues.values()].flat().length;
    const jobsBefore = app.subtitles.jobs.length;

    const again = await app.importSubtitles({ ...upload, userId: "u2" });
    expect(again.outcome).toBe("DUPLICATE");
    expect(again.steps.at(-1)).toEqual({ key: "duplicates", detail: { key: "identicalFound" } });
    expect(again).toMatchObject({ cueCount: 23, hasPortuguese: true, alignment: { pairs: 22 } });
    expect(app.subtitles.files.size).toBe(filesBefore);
    expect([...app.subtitles.cues.values()].flat().length).toBe(cuesBefore);
    expect(app.subtitles.jobs.length).toBe(jobsBefore);
  });

  it("deduplica por episódio: o mesmo arquivo pode entrar em outro episódio", async () => {
    await app.importSubtitles({ userId: "u1", episodeId: "ep-1", english: fixture("sample.en.srt") });
    const other = await app.importSubtitles({
      userId: "u1",
      episodeId: "ep-2",
      english: fixture("sample.en.srt"),
    });
    expect(other.outcome).toBe("PROCESSED");
    expect(app.subtitles.files.size).toBe(2);
  });

  it("aceita só inglês e deixa as falas sem tradução da legenda", async () => {
    const result = await app.importSubtitles({
      userId: "u1",
      episodeId: "ep-1",
      english: fixture("sample.en.srt"),
    });
    expect(result).toMatchObject({ outcome: "PROCESSED", hasPortuguese: false, alignment: null });
    const script = await app.getEpisodeScript("ep-1");
    expect(script?.hasPortuguese).toBe(false);
    expect(script?.lines.every((line) => line.translation === null && line.translationSource === null)).toBe(
      true,
    );
  });

  it("acrescenta o português depois, sem recriar as falas em inglês", async () => {
    await app.importSubtitles({ userId: "u1", episodeId: "ep-1", english: fixture("sample.en.srt") });
    const englishCueIds = (await app.getEpisodeScript("ep-1"))?.lines.map((line) => line.cueId);
    const result = await app.importSubtitles({
      userId: "u2",
      episodeId: "ep-1",
      english: fixture("sample.en.srt"),
      portuguese: fixture("sample.pt-BR.srt"),
    });
    expect(result).toMatchObject({ outcome: "PROCESSED", hasPortuguese: true, alignment: { pairs: 22 } });
    expect((await app.getEpisodeScript("ep-1"))?.lines.map((line) => line.cueId)).toEqual(englishCueIds);
  });

  it("recusa versão diferente de uma legenda que já existe", async () => {
    await app.importSubtitles({
      userId: "u1",
      episodeId: "ep-1",
      english: fixture("sample.en.srt"),
      portuguese: fixture("sample.pt-BR.srt"),
    });
    const otherEnglish = text("outra.srt", "1\n00:00:01,000 --> 00:00:02,000\nDifferent line\n");
    await expect(
      app.importSubtitles({ userId: "u1", episodeId: "ep-1", english: otherEnglish }),
    ).rejects.toMatchObject({
      code: "SUBTITLE_VERSION_CONFLICT",
    });
    const otherPortuguese = text("outra.pt.srt", "1\n00:00:01,000 --> 00:00:02,000\nOutra fala\n");
    await expect(
      app.importSubtitles({
        userId: "u1",
        episodeId: "ep-1",
        english: fixture("sample.en.srt"),
        portuguese: otherPortuguese,
      }),
    ).rejects.toMatchObject({ code: "SUBTITLE_VERSION_CONFLICT" });
    expect(app.subtitles.episodeStatus.get("ep-1")?.status).toBe("READY");
  });

  it("recusa arquivo inválido sem mudar o episódio", async () => {
    await expect(
      app.importSubtitles({ userId: "u1", episodeId: "ep-1", english: text("legenda.txt", "x") }),
    ).rejects.toMatchObject({ code: "SUBTITLE_INVALID" });
    await expect(
      app.importSubtitles({
        userId: "u1",
        episodeId: "ep-1",
        english: text("vazia.srt", "isto não é uma legenda"),
      }),
    ).rejects.toMatchObject({ code: "SUBTITLE_INVALID" });
    await expect(
      app.importSubtitles({ userId: "u1", episodeId: "nao-existe", english: fixture("sample.en.srt") }),
    ).rejects.toMatchObject({ code: "EPISODE_NOT_FOUND" });
    expect(app.subtitles.episodeStatus.size).toBe(0);
    expect(app.subtitles.files.size).toBe(0);
  });

  it("marca FAILED com o motivo quando a gravação falha e permite reenviar", async () => {
    app.subtitles.failNextSave = true;
    await expect(
      app.importSubtitles({ userId: "u1", episodeId: "ep-1", english: fixture("sample.en.srt") }),
    ).rejects.toThrow("banco indisponível");
    expect(app.subtitles.episodeStatus.get("ep-1")?.status).toBe("FAILED");
    expect(app.subtitles.jobs.at(-1)).toMatchObject({ status: "FAILED", reason: "banco indisponível" });

    const retry = await app.importSubtitles({
      userId: "u1",
      episodeId: "ep-1",
      english: fixture("sample.en.srt"),
    });
    expect(retry.outcome).toBe("PROCESSED");
    expect(app.subtitles.episodeStatus.get("ep-1")?.status).toBe("READY");
    expect(app.subtitles.files.size).toBe(1);
  });

  it("guarda o filme em catalog/movies", async () => {
    await app.importSubtitles({ userId: "u1", episodeId: "movie-ep", english: fixture("sample.en.srt") });
    expect([...app.storage.files.keys()]).toEqual(["catalog/movies/media-2/original.en.srt"]);
  });
});

describe("roteiro do episódio para leitura", () => {
  it("entrega cada fala EN com a tradução da legenda PT, tratando 1:N, N:1 e fala sem par", async () => {
    const app = setup();
    await app.importSubtitles({
      userId: "u1",
      episodeId: "ep-1",
      english: fixture("sample.en.srt"),
      portuguese: fixture("sample.pt-BR.srt"),
    });
    const script = await app.getEpisodeScript("ep-1");
    const lines = script?.lines ?? [];
    expect(lines).toHaveLength(23);
    expect(lines[0]).toMatchObject({
      text: "Hey, what are you up to tonight?",
      translation: "Ei, o que você vai fazer hoje à noite?",
      translationSource: "subtitle_pt",
      startsScene: true,
      sceneIndex: 0,
    });
    expect(lines[1]?.translation).toBe("Nada demais. Ia ficar em casa e colocar o sono em dia.");
    const merged = "Sinceramente? Foi um desastre total. Ela passou a noite inteira no celular.";
    expect(lines[6]?.translation).toBe(merged);
    expect(lines[7]?.translation).toBe(merged);
    expect(lines[21]).toMatchObject({ text: "Promise?", translation: null, translationSource: null });
    expect(lines.filter((line) => line.startsScene).map((line) => line.sequence)).toEqual([1, 6, 12, 17]);
  });

  it("usa a tradução por IA guardada quando a fala não tem par", async () => {
    const app = setup();
    await app.importSubtitles({
      userId: "u1",
      episodeId: "ep-1",
      english: fixture("sample.en.srt"),
      portuguese: fixture("sample.pt-BR.srt"),
    });
    const before = await app.getEpisodeScript("ep-1");
    const orphan = before?.lines[21];
    if (!orphan) throw new Error("fala esperada");
    await app.subtitles.saveCueTranslation(orphan.cueId, "Promete?", new Date());
    const after = await app.getEpisodeScript("ep-1");
    expect(after?.lines[21]).toMatchObject({ translation: "Promete?", translationSource: "llm" });
    expect(after?.lines[0]?.translationSource).toBe("subtitle_pt");
    expect(await app.getEpisodeScript("sem-legenda")).toBeNull();
  });
});
