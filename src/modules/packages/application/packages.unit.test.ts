import { describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { isAppError } from "@/shared/errors";
import { SequentialIds } from "@/shared/ids";
import { sha256Hex } from "@/shared/hash";
import { InMemoryFileStorage } from "@/shared/storage";
import { makeExportPackage } from "./export-package";
import { makeImportPackage, makeInspectPackage } from "./import-package";
import { InMemoryPackageCatalog, JsonArchive } from "./testing/fakes";

const encode = (text: string) => new TextEncoder().encode(text);
const card = (cueId: string) => ({
  cueId,
  cueSequence: 1,
  startToken: 0,
  endToken: 1,
  startMs: 0,
  endMs: 1000,
  kind: "phrase" as const,
  term: "pick up",
  itemType: "phrasal_verb" as const,
  difficulty: "B1" as const,
  meaning: "pegar",
  meaningSource: "llm" as const,
  pronunciation: null,
  exampleEnglish: null,
  examplePortuguese: null,
  lineText: "pick up the tab",
  lineTranslation: "pagar a conta",
  lineTranslationSource: "subtitle_pt" as const,
});

function source() {
  const catalog = new InMemoryPackageCatalog();
  const storage = new InMemoryFileStorage();
  catalog.works.set("m1", {
    id: "m1",
    metadataProvider: "fake",
    externalId: "friends",
    type: "series",
    title: "Friends",
    originalTitle: "Friends",
    overview: "",
    year: 1994,
    posterPath: null,
    backdropPath: null,
    posterColors: { c1: "#000", c2: "#fff", fg: "#fff" },
    levelMin: "A2",
    levelMax: "B1",
    accent: null,
  });
  catalog.seasons.set("m1", [{ id: "s1", seasonNumber: 1, title: "Temporada 1", episodeCount: 2 }]);
  catalog.episodes.set("m1", [
    {
      id: "e1",
      seasonNumber: 1,
      episodeNumber: 1,
      title: "Pilot",
      overview: "",
      durationSeconds: null,
      stillPath: null,
      ready: true,
      subtitles: [
        { language: "en", sha256: "a".repeat(64), storagePath: "sub/en.srt", originalFilename: "ep1.en.srt" },
        {
          language: "pt-BR",
          sha256: "b".repeat(64),
          storagePath: "sub/pt.srt",
          originalFilename: "ep1.pt.srt",
        },
      ],
      cues: [{ id: "c1", sequence: 1, text: "pick up the tab" }],
      cards: [card("c1")],
    },
    {
      id: "e2",
      seasonNumber: 1,
      episodeNumber: 2,
      title: "Segundo",
      overview: "",
      durationSeconds: null,
      stillPath: null,
      ready: false,
      subtitles: [],
      cues: [],
      cards: [],
    },
  ]);
  storage.files.set("sub/en.srt", encode("pick up the tab"));
  storage.files.set("sub/pt.srt", encode("pagar a conta"));
  storage.files.set("audio/v1/h.wav", encode("RIFF"));
  catalog.audio.push({
    textHash: sha256Hex("pick up the tab"),
    voiceId: "v1",
    language: "en",
    modelVersion: "1",
    format: "wav",
    storagePath: "audio/v1/h.wav",
  });
  return { catalog, storage };
}

function target() {
  const catalog = new InMemoryPackageCatalog();
  const storage = new InMemoryFileStorage();
  const deps = {
    reader: catalog,
    writer: catalog,
    archive: new JsonArchive(),
    storage,
    clock: new FixedClock("2026-10-13T12:00:00Z"),
    ids: new SequentialIds("id"),
  };
  return { catalog, storage, inspect: makeInspectPackage(deps), import: makeImportPackage(deps) };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "ok";
  } catch (error) {
    return isAppError(error) ? error.code : "unexpected";
  }
}

const everything = { subtitles: true, cards: true, audio: true };

describe("pacotes", () => {
  it("exporta uma obra com legendas, cards e áudio, e o pacote entra inteiro em outra instalação", async () => {
    const from = source();
    const exported = await makeExportPackage({
      reader: from.catalog,
      archive: new JsonArchive(),
      storage: from.storage,
      clock: new FixedClock("2026-10-13T12:00:00Z"),
    })({ scope: { kind: "work", mediaId: "m1" }, options: everything });
    expect(exported.filename).toBe("friends.deixa.zip");
    expect(exported.summary).toEqual({ episodes: 2, subtitles: 2, cards: 1, audio: 1 });

    const to = target();
    const preview = await to.inspect({ userId: "ana", bytes: exported.bytes });
    expect(preview.works[0]?.status).toBe("new");
    expect(
      preview.works[0]?.episodes.map((episode) => [episode.label, episode.subtitles, episode.cards]),
    ).toEqual([
      ["T1 · E1", 2, 1],
      ["T1 · E2", 0, 0],
    ]);
    expect(preview.audio).toBe(1);

    const report = await to.import({ userId: "ana", uploadId: preview.uploadId });
    expect(report).toMatchObject({
      worksCreated: 1,
      episodesImported: 1,
      episodesSkipped: 0,
      cards: 1,
      audio: 1,
    });
    expect(to.catalog.imported[0]).toMatchObject({ english: "pick up the tab", portuguese: "pagar a conta" });
    expect(to.storage.files.has(`audio/v1/${sha256Hex("pick up the tab")}.wav`)).toBe(true);

    const again = await to.inspect({ userId: "ana", bytes: exported.bytes });
    expect(again.works[0]?.status).toBe("exists");
    const second = await to.import({ userId: "ana", uploadId: again.uploadId });
    expect(second).toMatchObject({
      worksCreated: 0,
      episodesImported: 0,
      episodesSkipped: 1,
      cards: 0,
      audio: 0,
    });
  });

  it("exporta só o episódio pedido, sem áudio quando não marcado", async () => {
    const from = source();
    const exported = await makeExportPackage({
      reader: from.catalog,
      archive: new JsonArchive(),
      storage: from.storage,
      clock: new FixedClock("2026-10-13T12:00:00Z"),
    })({
      scope: { kind: "episode", mediaId: "m1", episodeId: "e1" },
      options: { ...everything, audio: false },
    });
    expect(exported.filename).toBe("friends-t1e1.deixa.zip");
    expect(exported.summary).toEqual({ episodes: 1, subtitles: 2, cards: 1, audio: 0 });
  });

  it("recusa pacote adulterado, sem manifesto ou de versão mais nova", async () => {
    const from = source();
    const archive = new JsonArchive();
    const exported = await makeExportPackage({
      reader: from.catalog,
      archive,
      storage: from.storage,
      clock: new FixedClock("2026-10-13T12:00:00Z"),
    })({ scope: { kind: "work", mediaId: "m1" }, options: everything });
    const files = await archive.unpack(exported.bytes);
    const tampered = files.map((file) =>
      file.path === "catalog.json"
        ? { ...file, bytes: encode(new TextDecoder().decode(file.bytes).replace("Friends", "Enemies")) }
        : file,
    );
    const to = target();
    expect(await codeOf(to.inspect({ userId: "ana", bytes: await archive.pack(tampered) }))).toBe(
      "INVALID_INPUT",
    );
    expect(
      await codeOf(
        to.inspect({
          userId: "ana",
          bytes: await archive.pack(files.filter((f) => f.path !== "manifest.json")),
        }),
      ),
    ).toBe("INVALID_INPUT");
    const newer = files.map((file) =>
      file.path === "manifest.json"
        ? {
            ...file,
            bytes: encode(new TextDecoder().decode(file.bytes).replace('"version":1', '"version":99')),
          }
        : file,
    );
    expect(await codeOf(to.inspect({ userId: "ana", bytes: await archive.pack(newer) }))).toBe(
      "INVALID_INPUT",
    );
    expect(await codeOf(to.inspect({ userId: "ana", bytes: encode("isto não é um zip") }))).toBe(
      "INVALID_INPUT",
    );
  });

  it("um usuário não importa o arquivo enviado por outro", async () => {
    const from = source();
    const exported = await makeExportPackage({
      reader: from.catalog,
      archive: new JsonArchive(),
      storage: from.storage,
      clock: new FixedClock("2026-10-13T12:00:00Z"),
    })({ scope: { kind: "work", mediaId: "m1" }, options: everything });
    const to = target();
    const preview = await to.inspect({ userId: "ana", bytes: exported.bytes });
    expect(await codeOf(to.import({ userId: "lucas", uploadId: preview.uploadId }))).toBe("INVALID_INPUT");
    expect(await codeOf(to.import({ userId: "ana", uploadId: "../x" }))).toBe("INVALID_INPUT");
  });

  it("episódio que já tem outra legenda fica como está e vira aviso", async () => {
    const from = source();
    const exported = await makeExportPackage({
      reader: from.catalog,
      archive: new JsonArchive(),
      storage: from.storage,
      clock: new FixedClock("2026-10-13T12:00:00Z"),
    })({ scope: { kind: "episode", mediaId: "m1", episodeId: "e1" }, options: everything });
    const to = target();
    const preview = await to.inspect({ userId: "ana", bytes: exported.bytes });
    const work = await to.catalog.ensureWork({
      ...(await (async () => {
        const { works } = JSON.parse(
          new TextDecoder().decode(
            (await new JsonArchive().unpack(exported.bytes)).find((f) => f.path === "catalog.json")!.bytes,
          ),
        );
        return works[0];
      })()),
      createdBy: "ana",
      now: new Date(),
    });
    to.catalog.conflicts.add(work.episodeIds.get("s1e1")!);
    const report = await to.import({ userId: "ana", uploadId: preview.uploadId });
    expect(report.episodesSkipped).toBe(1);
    expect(report.warnings[0]).toMatch(/já tem outra legenda/);
  });
});
