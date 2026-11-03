import { beforeEach, describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { AppError } from "@/shared/errors";
import {
  normalizeRelease,
  rankCandidates,
  type SourceLanguage,
  type SubtitleCandidate,
} from "../domain/ranking";
import { FakeSubtitleSourceProvider } from "../infrastructure/fake-subtitle-source-provider";
import {
  REFRESH_INTERVAL_MINUTES,
  SEARCH_CACHE_HOURS,
  makeImportFromSource,
  makeSearchSubtitles,
  type CachedSearch,
  type EpisodeSource,
  type ImportedFile,
  type SourceProviderName,
  type SourceQuota,
  type SourceRepository,
  type SubtitleSourceProvider,
} from "./source-use-cases";

const candidate = (
  overrides: Partial<SubtitleCandidate> & { fileId: string; language: SourceLanguage },
): SubtitleCandidate => ({
  release: "Show.S01E01.720p.WEB-GRP",
  fileName: "arquivo.srt",
  downloads: 100,
  rating: 0,
  hearingImpaired: false,
  machineTranslated: false,
  fps: 23.976,
  uploader: null,
  ...overrides,
});

const PAIR = { target: "en", native: "pt-BR" } as const;
const SPANISH_PAIR = { target: "es", native: "pt-BR" } as const;

describe("normalização de release", () => {
  it("ignora caixa, separadores, extensão e marcas de idioma", () => {
    expect(normalizeRelease("Show.S01E01.720p.WEB-GRP.eng.srt")).toBe("show.s01e01.720p.web.grp");
    expect(normalizeRelease("show s01e01 720p web grp [PT-BR]")).toBe("show.s01e01.720p.web.grp");
    expect(normalizeRelease("Outro.S01E01.HDTV-XYZ")).not.toBe(normalizeRelease("Show.S01E01.720p.WEB-GRP"));
    expect(normalizeRelease("  ")).toBe("");
  });
});

describe("ranqueamento de legendas", () => {
  it("sugere primeiro o par EN e PT do mesmo release, mesmo com menos downloads", () => {
    const ranking = rankCandidates(
      [
        candidate({ fileId: "en-pop", language: "en", release: "Show.S01E01.HDTV-XYZ", downloads: 9000 }),
        candidate({ fileId: "en-par", language: "en", release: "Show.S01E01.720p.WEB-GRP", downloads: 300 }),
        candidate({
          fileId: "pt-par",
          language: "pt-BR",
          release: "show s01e01 720p web grp",
          downloads: 200,
        }),
        candidate({
          fileId: "pt-pop",
          language: "pt-BR",
          release: "Show.S01E01.BluRay-ABC",
          downloads: 4000,
        }),
      ],
      PAIR,
    );
    expect(ranking.suggestion).toMatchObject({ sameRelease: true });
    expect([ranking.suggestion.target?.fileId, ranking.suggestion.native?.fileId]).toEqual([
      "en-par",
      "pt-par",
    ]);
    expect(ranking.target.map((item) => item.fileId)).toEqual(["en-pop", "en-par"]);
  });

  it("nome genérico, sem marca de release, não conta como mesmo release", () => {
    const ranking = rankCandidates(
      [
        candidate({ fileId: "en", language: "en", release: '"Friends" (1994)' }),
        candidate({ fileId: "pt", language: "pt-BR", release: '"Friends" (1994)' }),
      ],
      PAIR,
    );
    expect(ranking.suggestion).toMatchObject({ sameRelease: false, target: { fileId: "en" } });
    expect(ranking.suggestion.native?.fileId).toBe("pt");
  });

  it("sem par do mesmo release, usa o melhor de cada idioma por downloads e avaliação", () => {
    const ranking = rankCandidates(
      [
        candidate({ fileId: "en-a", language: "en", release: "A", downloads: 10, rating: 9 }),
        candidate({ fileId: "en-b", language: "en", release: "B", downloads: 10, rating: 2 }),
        candidate({ fileId: "en-c", language: "en", release: "C", downloads: 50 }),
        candidate({ fileId: "pt-a", language: "pt-BR", release: "D", downloads: 5 }),
      ],
      PAIR,
    );
    expect(ranking.suggestion).toMatchObject({ sameRelease: false });
    expect(ranking.target.map((item) => item.fileId)).toEqual(["en-c", "en-a", "en-b"]);
    expect(ranking.suggestion.native?.fileId).toBe("pt-a");
  });

  it("prefere sem marcação para surdos e deixa as marcadas como alternativa", () => {
    const ranking = rankCandidates(
      [
        candidate({ fileId: "en-hi", language: "en", release: "A", downloads: 9000, hearingImpaired: true }),
        candidate({ fileId: "en-ok", language: "en", release: "B", downloads: 10 }),
      ],
      PAIR,
    );
    expect(ranking.target.map((item) => item.fileId)).toEqual(["en-ok", "en-hi"]);
  });

  it("descarta tradução automática quando há alternativa e mantém quando é a única", () => {
    const withHuman = rankCandidates(
      [
        candidate({
          fileId: "pt-ia",
          language: "pt-BR",
          release: "A",
          downloads: 9000,
          machineTranslated: true,
        }),
        candidate({ fileId: "pt-humana", language: "pt-BR", release: "B", downloads: 3 }),
        candidate({ fileId: "en", language: "en", release: "C" }),
      ],
      PAIR,
    );
    expect(withHuman.native.map((item) => item.fileId)).toEqual(["pt-humana"]);
    const onlyMachine = rankCandidates(
      [candidate({ fileId: "pt-ia", language: "pt-BR", machineTranslated: true })],
      PAIR,
    );
    expect(onlyMachine.native.map((item) => item.fileId)).toEqual(["pt-ia"]);
  });

  it("entre FPS diferentes, prefere o mais comum nos resultados", () => {
    const ranking = rankCandidates(
      [
        candidate({ fileId: "en-25", language: "en", release: "A", downloads: 900, fps: 25 }),
        candidate({ fileId: "en-23", language: "en", release: "B", downloads: 100, fps: 23.976 }),
        candidate({ fileId: "pt-23a", language: "pt-BR", release: "C", fps: 23.976 }),
        candidate({ fileId: "pt-23b", language: "pt-BR", release: "D", fps: 23.976 }),
      ],
      PAIR,
    );
    expect(ranking.target.map((item) => item.fileId)).toEqual(["en-23", "en-25"]);
  });

  it("devolve sugestão vazia quando não há resultado no idioma", () => {
    const ranking = rankCandidates([candidate({ fileId: "pt", language: "pt-BR" })], PAIR);
    expect(ranking.suggestion).toEqual({
      target: null,
      native: ranking.native[0],
      sameRelease: false,
    });
    expect(rankCandidates([], PAIR).suggestion).toEqual({ target: null, native: null, sameRelease: false });
  });
});

class InMemorySources implements SourceRepository {
  readonly cache = new Map<string, CachedSearch>();
  readonly quota = new Map<string, SourceQuota & { updatedAt: Date }>();

  async getCachedSearch(episodeId: string, provider: SourceProviderName) {
    return this.cache.get(`${provider}:${episodeId}`) ?? null;
  }

  async saveSearch(episodeId: string, provider: SourceProviderName, search: CachedSearch) {
    this.cache.set(`${provider}:${episodeId}`, search);
  }

  async getQuota(provider: string) {
    return this.quota.get(provider) ?? null;
  }

  async saveQuota(provider: string, quota: SourceQuota, now: Date) {
    this.quota.set(provider, { ...quota, updatedAt: now });
  }

  readonly downloads: { userId: string; at: Date }[] = [];

  async recordDownload(userId: string, _provider: SourceProviderName, _fileId: string, now: Date) {
    this.downloads.push({ userId, at: now });
  }

  async countUserDownloads(userId: string, _provider: SourceProviderName, since: Date) {
    return this.downloads.filter((entry) => entry.userId === userId && entry.at > since).length;
  }
}

function setup(
  options: { provider?: SubtitleSourceProvider; userDailyDownloads?: number; failImport?: boolean } = {},
) {
  const provider = options.provider ?? new FakeSubtitleSourceProvider();
  const sources = new InMemorySources();
  const clock = new FixedClock("2026-10-11T12:00:00Z");
  const episodes = new Map<string, EpisodeSource>([
    [
      "ep-1",
      {
        episodeId: "ep-1",
        query: { kind: "episode", showTmdbId: "1396", seasonNumber: 1, episodeNumber: 1 },
        existing: [],
      },
    ],
    ["ep-sem-tmdb", { episodeId: "ep-sem-tmdb", query: null, existing: [] }],
  ]);
  const stored = new Map<string, Uint8Array>();
  const imported: { userId: string; english: ImportedFile; portuguese?: ImportedFile }[] = [];
  const deps = {
    quotaKey: "fake",
    provider,
    userDailyDownloads: options.userDailyDownloads ?? 10,
    sources,
    clock,
    findEpisodeSource: async (episodeId: string) => episodes.get(episodeId) ?? null,
    readExistingFile: async (episodeId: string, language: SourceLanguage) =>
      stored.get(`${episodeId}:${language}`) ?? null,
    importSubtitles: async (input: {
      userId: string;
      episodeId: string;
      target: { language: SourceLanguage; upload: ImportedFile };
      native?: { language: SourceLanguage; upload: ImportedFile };
    }) => {
      if (options.failImport) throw new AppError("SUBTITLE_INVALID", "arquivo inválido");
      imported.push({ userId: input.userId, english: input.target.upload, portuguese: input.native?.upload });
      const episode = episodes.get(input.episodeId);
      for (const file of [input.target, input.native]) {
        if (!file || !episode) continue;
        stored.set(`${input.episodeId}:${file.language}`, file.upload.bytes);
        if (!episode.existing.some((known) => known.language === file.language)) {
          episode.existing.push({
            language: file.language,
            externalFileId: file.upload.origin.externalFileId,
          });
        }
      }
      return {
        outcome: "PROCESSED" as const,
        steps: [{ key: "publish", detail: { key: "ready" } }],
        hasNative: Boolean(input.native),
      };
    },
  };
  return {
    sources,
    clock,
    episodes,
    imported,
    provider,
    search: makeSearchSubtitles(deps),
    importFrom: makeImportFromSource(deps),
  };
}

describe("busca de legendas com cache", () => {
  let app: ReturnType<typeof setup>;
  const fake = () => app.provider as FakeSubtitleSourceProvider;

  beforeEach(() => {
    app = setup();
  });

  it("busca na fonte, guarda por 24 horas e só busca de novo a pedido ou depois do prazo", async () => {
    const first = await app.search({ episodeId: "ep-1", pair: PAIR });
    expect(first).toMatchObject({ provider: "fake", cached: false, quota: null });
    expect(first.ranking.suggestion).toMatchObject({ sameRelease: true });
    expect((await app.search({ episodeId: "ep-1", pair: PAIR })).cached).toBe(true);
    expect(fake().calls.search).toBe(1);

    app.clock.advanceMs((REFRESH_INTERVAL_MINUTES + 1) * 60_000);
    await app.search({ episodeId: "ep-1", pair: PAIR, refresh: true });
    expect(fake().calls.search).toBe(2);
    app.clock.advanceMs((SEARCH_CACHE_HOURS + 1) * 3_600_000);
    expect((await app.search({ episodeId: "ep-1", pair: PAIR })).cached).toBe(false);
    expect(fake().calls.search).toBe(3);
  });

  it("o cache de outro par de idiomas não esconde as legendas do par pedido", async () => {
    await app.search({ episodeId: "ep-1", pair: PAIR });
    const spanish = await app.search({ episodeId: "ep-1", pair: SPANISH_PAIR });
    expect(spanish.cached).toBe(false);
    expect(fake().calls.search).toBe(2);
    expect(spanish.ranking.suggestion?.target?.fileId).toBe("fake-es-1");
    expect((await app.search({ episodeId: "ep-1", pair: PAIR })).cached).toBe(true);
    expect((await app.search({ episodeId: "ep-1", pair: SPANISH_PAIR })).cached).toBe(true);
  });

  it("importa legenda em espanhol a partir da busca guardada", async () => {
    await app.search({ episodeId: "ep-1", pair: PAIR });
    await app.search({ episodeId: "ep-1", pair: SPANISH_PAIR });
    const result = await app.importFrom({
      pair: SPANISH_PAIR,
      userId: "ana",
      episodeId: "ep-1",
      targetFileId: "fake-es-1",
      nativeFileId: "fake-pt-1",
    });
    expect(result).toMatchObject({ outcome: "PROCESSED", hasNative: true });
    const english = await app.importFrom({
      pair: PAIR,
      userId: "bia",
      episodeId: "ep-1",
      targetFileId: "fake-en-1",
      nativeFileId: null,
    });
    expect(english).toMatchObject({ outcome: "PROCESSED" });
  });

  it("buscar nunca baixa nada", async () => {
    await app.search({ episodeId: "ep-1", pair: PAIR });
    expect(fake().calls.download).toBe(0);
    expect(app.imported).toEqual([]);
  });

  it("explica quando a obra não tem identificador para buscar ou o episódio não existe", async () => {
    await expect(app.search({ episodeId: "ep-sem-tmdb", pair: PAIR })).rejects.toMatchObject({
      code: "SUBTITLE_SOURCE_EMPTY",
    });
    await expect(app.search({ episodeId: "nada", pair: PAIR })).rejects.toMatchObject({
      code: "EPISODE_NOT_FOUND",
    });
  });
});

describe("importação a partir da fonte", () => {
  let app: ReturnType<typeof setup>;
  const fake = () => app.provider as FakeSubtitleSourceProvider;

  beforeEach(async () => {
    app = setup();
    await app.search({ episodeId: "ep-1", pair: PAIR });
  });

  it("baixa só o que o usuário escolheu, entrega ao pipeline com a origem e atualiza a cota", async () => {
    const result = await app.importFrom({
      pair: PAIR,
      userId: "ana",
      episodeId: "ep-1",
      targetFileId: "fake-en-1",
      nativeFileId: "fake-pt-1",
    });
    expect(result).toMatchObject({
      outcome: "PROCESSED",
      hasNative: true,
      downloadsUsed: 2,
      quota: { remaining: 8 },
    });
    expect(app.imported[0]?.english.origin).toEqual({
      source: "opensubtitles",
      externalFileId: "fake-en-1",
      releaseName: "Sample.Show.S01E01.720p.WEB-DEMO",
      author: "demo",
      hearingImpaired: false,
      fps: 23.976,
    });
    expect(app.imported[0]?.english.filename).toMatch(/\.srt$/);
    expect((await app.search({ episodeId: "ep-1", pair: PAIR })).quota).toEqual({
      remaining: 8,
      resetAt: null,
    });
  });

  it("nunca baixa o mesmo arquivo duas vezes: reaproveita o que já está no episódio", async () => {
    await app.importFrom({
      pair: PAIR,
      userId: "ana",
      episodeId: "ep-1",
      targetFileId: "fake-en-1",
      nativeFileId: null,
    });
    expect(fake().calls.download).toBe(1);
    const again = await app.importFrom({
      pair: PAIR,
      userId: "lucas",
      episodeId: "ep-1",
      targetFileId: "fake-en-1",
      nativeFileId: "fake-pt-1",
    });
    expect(again.downloadsUsed).toBe(1);
    expect(fake().calls.download).toBe(2);
  });

  it("segue só com inglês quando não há português escolhido", async () => {
    const result = await app.importFrom({
      pair: PAIR,
      userId: "ana",
      episodeId: "ep-1",
      targetFileId: "fake-en-1",
      nativeFileId: null,
    });
    expect(result).toMatchObject({ hasNative: false, downloadsUsed: 1 });
    expect(app.imported[0]?.portuguese).toBeUndefined();
  });

  it("recusa arquivo que não veio da busca daquele episódio ou idioma trocado, sem gastar download", async () => {
    await expect(
      app.importFrom({
        pair: PAIR,
        userId: "ana",
        episodeId: "ep-1",
        targetFileId: "999",
        nativeFileId: null,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      app.importFrom({
        pair: PAIR,
        userId: "ana",
        episodeId: "ep-1",
        targetFileId: "fake-pt-1",
        nativeFileId: null,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      app.importFrom({
        pair: PAIR,
        userId: "ana",
        episodeId: "ep-sem-tmdb",
        targetFileId: "fake-en-1",
        nativeFileId: null,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(fake().calls.download).toBe(0);
  });

  it("não troca a legenda de um episódio que já tem outra versão", async () => {
    await app.importFrom({
      pair: PAIR,
      userId: "ana",
      episodeId: "ep-1",
      targetFileId: "fake-en-1",
      nativeFileId: null,
    });
    await expect(
      app.importFrom({
        pair: PAIR,
        userId: "ana",
        episodeId: "ep-1",
        targetFileId: "fake-en-2",
        nativeFileId: null,
      }),
    ).rejects.toMatchObject({ code: "SUBTITLE_VERSION_CONFLICT" });
    expect(fake().calls.download).toBe(1);
  });

  it("avisa quando a cota acaba e não importa nada pela metade", async () => {
    for (let used = 0; used < 10; used += 1) await fake().download("fake-en-1");
    await expect(
      app.importFrom({
        pair: PAIR,
        userId: "ana",
        episodeId: "ep-1",
        targetFileId: "fake-en-1",
        nativeFileId: "fake-pt-1",
      }),
    ).rejects.toMatchObject({ code: "SUBTITLE_SOURCE_QUOTA" });
    expect(app.imported).toEqual([]);
  });
});

describe("cota conhecida", () => {
  it("não gasta download quando a cota conhecida não cobre o pedido e esquece a cota depois de um dia", async () => {
    const app = setup();
    const fake = app.provider as FakeSubtitleSourceProvider;
    await app.search({ episodeId: "ep-1", pair: PAIR });
    await app.sources.saveQuota("fake", { remaining: 1, resetAt: null }, app.clock.now());
    await expect(
      app.importFrom({
        pair: PAIR,
        userId: "ana",
        episodeId: "ep-1",
        targetFileId: "fake-en-1",
        nativeFileId: "fake-pt-1",
      }),
    ).rejects.toMatchObject({ code: "SUBTITLE_SOURCE_QUOTA" });
    expect(fake.calls.download).toBe(0);

    app.clock.advanceMs(25 * 3_600_000);
    expect((await app.search({ episodeId: "ep-1", pair: PAIR })).quota).toBeNull();
  });

  it("guarda cota zerada quando a fonte recusa por limite e respeita o horário de renovação", async () => {
    const app = setup();
    const fake = app.provider as FakeSubtitleSourceProvider;
    await app.search({ episodeId: "ep-1", pair: PAIR });
    for (let used = 0; used < 10; used += 1) await fake.download("fake-en-1");
    await expect(
      app.importFrom({
        pair: PAIR,
        userId: "ana",
        episodeId: "ep-1",
        targetFileId: "fake-en-1",
        nativeFileId: null,
      }),
    ).rejects.toMatchObject({ code: "SUBTITLE_SOURCE_QUOTA" });
    expect((await app.search({ episodeId: "ep-1", pair: PAIR })).quota).toEqual({
      remaining: 0,
      resetAt: null,
    });

    await app.sources.saveQuota(
      "fake",
      { remaining: 0, resetAt: new Date("2026-10-11T13:00:00Z") },
      app.clock.now(),
    );
    app.clock.advanceMs(2 * 3_600_000);
    expect((await app.search({ episodeId: "ep-1", pair: PAIR })).quota).toBeNull();
  });
});

describe("limites por usuário", () => {
  it("cada usuário tem um teto próprio de downloads por dia, mesmo com pedidos simultâneos", async () => {
    const app = setup({ userDailyDownloads: 2 });
    const fake = app.provider as FakeSubtitleSourceProvider;
    app.episodes.set("ep-2", {
      episodeId: "ep-2",
      query: { kind: "episode", showTmdbId: "1396", seasonNumber: 1, episodeNumber: 2 },
      existing: [],
    });
    await app.search({ episodeId: "ep-1", pair: PAIR });
    await app.search({ episodeId: "ep-2", pair: PAIR });
    const pair = { targetFileId: "fake-en-1", nativeFileId: "fake-pt-1" };
    const results = await Promise.allSettled([
      app.importFrom({ pair: PAIR, userId: "ana", episodeId: "ep-1", ...pair }),
      app.importFrom({ pair: PAIR, userId: "ana", episodeId: "ep-2", ...pair }),
    ]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected"]);
    expect(results[1]).toMatchObject({ reason: { code: "SUBTITLE_SOURCE_QUOTA" } });
    expect(fake.calls.download).toBe(2);

    const other = await app.importFrom({ pair: PAIR, userId: "lucas", episodeId: "ep-2", ...pair });
    expect(other.downloadsUsed).toBe(2);
  });

  it("buscar de novo em seguida não repete a chamada à fonte", async () => {
    const app = setup();
    const fake = app.provider as FakeSubtitleSourceProvider;
    await app.search({ episodeId: "ep-1", pair: PAIR });
    expect((await app.search({ episodeId: "ep-1", pair: PAIR, refresh: true })).cached).toBe(true);
    expect(fake.calls.search).toBe(1);
    app.clock.advanceMs((REFRESH_INTERVAL_MINUTES + 1) * 60_000);
    expect((await app.search({ episodeId: "ep-1", pair: PAIR, refresh: true })).cached).toBe(false);
    expect(fake.calls.search).toBe(2);
  });
});

describe("contabilidade que não deixa escapar", () => {
  it("conta o download mesmo quando a importação falha depois de baixar", async () => {
    const app = setup({ userDailyDownloads: 2, failImport: true });
    const fake = app.provider as FakeSubtitleSourceProvider;
    await app.search({ episodeId: "ep-1", pair: PAIR });
    const pair = {
      userId: "ana",
      episodeId: "ep-1",
      pair: PAIR,
      targetFileId: "fake-en-1",
      nativeFileId: "fake-pt-1",
    };
    await expect(app.importFrom(pair)).rejects.toMatchObject({ code: "SUBTITLE_INVALID" });
    expect(fake.calls.download).toBe(2);
    await expect(app.importFrom(pair)).rejects.toMatchObject({ code: "SUBTITLE_SOURCE_QUOTA" });
    expect(fake.calls.download).toBe(2);
  });

  it("buscas simultâneas do mesmo episódio fazem uma única chamada à fonte", async () => {
    const app = setup();
    const fake = app.provider as FakeSubtitleSourceProvider;
    await Promise.all([
      app.search({ episodeId: "ep-1", pair: PAIR, refresh: true }),
      app.search({ episodeId: "ep-1", pair: PAIR, refresh: true }),
      app.search({ episodeId: "ep-1", pair: PAIR }),
    ]);
    expect(fake.calls.search).toBe(1);
  });
});
