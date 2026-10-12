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
    const ranking = rankCandidates([
      candidate({ fileId: "en-pop", language: "en", release: "Show.S01E01.HDTV-XYZ", downloads: 9000 }),
      candidate({ fileId: "en-par", language: "en", release: "Show.S01E01.720p.WEB-GRP", downloads: 300 }),
      candidate({ fileId: "pt-par", language: "pt-BR", release: "show s01e01 720p web grp", downloads: 200 }),
      candidate({ fileId: "pt-pop", language: "pt-BR", release: "Show.S01E01.BluRay-ABC", downloads: 4000 }),
    ]);
    expect(ranking.suggestion).toMatchObject({ sameRelease: true });
    expect([ranking.suggestion.english?.fileId, ranking.suggestion.portuguese?.fileId]).toEqual([
      "en-par",
      "pt-par",
    ]);
    expect(ranking.english.map((item) => item.fileId)).toEqual(["en-pop", "en-par"]);
  });

  it("nome genérico, sem marca de release, não conta como mesmo release", () => {
    const ranking = rankCandidates([
      candidate({ fileId: "en", language: "en", release: '"Friends" (1994)' }),
      candidate({ fileId: "pt", language: "pt-BR", release: '"Friends" (1994)' }),
    ]);
    expect(ranking.suggestion).toMatchObject({ sameRelease: false, english: { fileId: "en" } });
    expect(ranking.suggestion.portuguese?.fileId).toBe("pt");
  });

  it("sem par do mesmo release, usa o melhor de cada idioma por downloads e avaliação", () => {
    const ranking = rankCandidates([
      candidate({ fileId: "en-a", language: "en", release: "A", downloads: 10, rating: 9 }),
      candidate({ fileId: "en-b", language: "en", release: "B", downloads: 10, rating: 2 }),
      candidate({ fileId: "en-c", language: "en", release: "C", downloads: 50 }),
      candidate({ fileId: "pt-a", language: "pt-BR", release: "D", downloads: 5 }),
    ]);
    expect(ranking.suggestion).toMatchObject({ sameRelease: false });
    expect(ranking.english.map((item) => item.fileId)).toEqual(["en-c", "en-a", "en-b"]);
    expect(ranking.suggestion.portuguese?.fileId).toBe("pt-a");
  });

  it("prefere sem marcação para surdos e deixa as marcadas como alternativa", () => {
    const ranking = rankCandidates([
      candidate({ fileId: "en-hi", language: "en", release: "A", downloads: 9000, hearingImpaired: true }),
      candidate({ fileId: "en-ok", language: "en", release: "B", downloads: 10 }),
    ]);
    expect(ranking.english.map((item) => item.fileId)).toEqual(["en-ok", "en-hi"]);
  });

  it("descarta tradução automática quando há alternativa e mantém quando é a única", () => {
    const withHuman = rankCandidates([
      candidate({
        fileId: "pt-ia",
        language: "pt-BR",
        release: "A",
        downloads: 9000,
        machineTranslated: true,
      }),
      candidate({ fileId: "pt-humana", language: "pt-BR", release: "B", downloads: 3 }),
      candidate({ fileId: "en", language: "en", release: "C" }),
    ]);
    expect(withHuman.portuguese.map((item) => item.fileId)).toEqual(["pt-humana"]);
    const onlyMachine = rankCandidates([
      candidate({ fileId: "pt-ia", language: "pt-BR", machineTranslated: true }),
    ]);
    expect(onlyMachine.portuguese.map((item) => item.fileId)).toEqual(["pt-ia"]);
  });

  it("entre FPS diferentes, prefere o mais comum nos resultados", () => {
    const ranking = rankCandidates([
      candidate({ fileId: "en-25", language: "en", release: "A", downloads: 900, fps: 25 }),
      candidate({ fileId: "en-23", language: "en", release: "B", downloads: 100, fps: 23.976 }),
      candidate({ fileId: "pt-23a", language: "pt-BR", release: "C", fps: 23.976 }),
      candidate({ fileId: "pt-23b", language: "pt-BR", release: "D", fps: 23.976 }),
    ]);
    expect(ranking.english.map((item) => item.fileId)).toEqual(["en-23", "en-25"]);
  });

  it("devolve sugestão vazia quando não há resultado no idioma", () => {
    const ranking = rankCandidates([candidate({ fileId: "pt", language: "pt-BR" })]);
    expect(ranking.suggestion).toEqual({
      english: null,
      portuguese: ranking.portuguese[0],
      sameRelease: false,
    });
    expect(rankCandidates([]).suggestion).toEqual({ english: null, portuguese: null, sameRelease: false });
  });
});

class InMemorySources implements SourceRepository {
  readonly cache = new Map<string, { candidates: SubtitleCandidate[]; fetchedAt: Date }>();
  readonly quota = new Map<string, SourceQuota & { updatedAt: Date }>();

  async getCachedSearch(episodeId: string, provider: SourceProviderName) {
    return this.cache.get(`${provider}:${episodeId}`) ?? null;
  }

  async saveSearch(
    episodeId: string,
    provider: SourceProviderName,
    candidates: SubtitleCandidate[],
    now: Date,
  ) {
    this.cache.set(`${provider}:${episodeId}`, { candidates, fetchedAt: now });
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
      english: ImportedFile;
      portuguese?: ImportedFile;
    }) => {
      if (options.failImport) throw new AppError("SUBTITLE_INVALID", "arquivo inválido");
      imported.push({ userId: input.userId, english: input.english, portuguese: input.portuguese });
      const episode = episodes.get(input.episodeId);
      for (const file of [input.english, input.portuguese]) {
        if (!file || !episode) continue;
        const language: SourceLanguage = file === input.english ? "en" : "pt-BR";
        stored.set(`${input.episodeId}:${language}`, file.bytes);
        if (!episode.existing.some((known) => known.language === language)) {
          episode.existing.push({ language, externalFileId: file.origin.externalFileId });
        }
      }
      return {
        outcome: "PROCESSED" as const,
        steps: [{ label: "Publicando no catálogo", detail: "READY" }],
        hasPortuguese: Boolean(input.portuguese),
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
    const first = await app.search({ episodeId: "ep-1" });
    expect(first).toMatchObject({ provider: "fake", cached: false, quota: null });
    expect(first.ranking.suggestion).toMatchObject({ sameRelease: true });
    expect((await app.search({ episodeId: "ep-1" })).cached).toBe(true);
    expect(fake().calls.search).toBe(1);

    app.clock.advanceMs((REFRESH_INTERVAL_MINUTES + 1) * 60_000);
    await app.search({ episodeId: "ep-1", refresh: true });
    expect(fake().calls.search).toBe(2);
    app.clock.advanceMs((SEARCH_CACHE_HOURS + 1) * 3_600_000);
    expect((await app.search({ episodeId: "ep-1" })).cached).toBe(false);
    expect(fake().calls.search).toBe(3);
  });

  it("buscar nunca baixa nada", async () => {
    await app.search({ episodeId: "ep-1" });
    expect(fake().calls.download).toBe(0);
    expect(app.imported).toEqual([]);
  });

  it("explica quando a obra não tem identificador para buscar ou o episódio não existe", async () => {
    await expect(app.search({ episodeId: "ep-sem-tmdb" })).rejects.toMatchObject({
      code: "SUBTITLE_SOURCE_EMPTY",
    });
    await expect(app.search({ episodeId: "nada" })).rejects.toMatchObject({ code: "EPISODE_NOT_FOUND" });
  });
});

describe("importação a partir da fonte", () => {
  let app: ReturnType<typeof setup>;
  const fake = () => app.provider as FakeSubtitleSourceProvider;

  beforeEach(async () => {
    app = setup();
    await app.search({ episodeId: "ep-1" });
  });

  it("baixa só o que o usuário escolheu, entrega ao pipeline com a origem e atualiza a cota", async () => {
    const result = await app.importFrom({
      userId: "ana",
      episodeId: "ep-1",
      englishFileId: "fake-en-1",
      portugueseFileId: "fake-pt-1",
    });
    expect(result).toMatchObject({
      outcome: "PROCESSED",
      hasPortuguese: true,
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
    expect((await app.search({ episodeId: "ep-1" })).quota).toEqual({ remaining: 8, resetAt: null });
  });

  it("nunca baixa o mesmo arquivo duas vezes: reaproveita o que já está no episódio", async () => {
    await app.importFrom({
      userId: "ana",
      episodeId: "ep-1",
      englishFileId: "fake-en-1",
      portugueseFileId: null,
    });
    expect(fake().calls.download).toBe(1);
    const again = await app.importFrom({
      userId: "lucas",
      episodeId: "ep-1",
      englishFileId: "fake-en-1",
      portugueseFileId: "fake-pt-1",
    });
    expect(again.downloadsUsed).toBe(1);
    expect(fake().calls.download).toBe(2);
  });

  it("segue só com inglês quando não há português escolhido", async () => {
    const result = await app.importFrom({
      userId: "ana",
      episodeId: "ep-1",
      englishFileId: "fake-en-1",
      portugueseFileId: null,
    });
    expect(result).toMatchObject({ hasPortuguese: false, downloadsUsed: 1 });
    expect(app.imported[0]?.portuguese).toBeUndefined();
  });

  it("recusa arquivo que não veio da busca daquele episódio ou idioma trocado, sem gastar download", async () => {
    await expect(
      app.importFrom({ userId: "ana", episodeId: "ep-1", englishFileId: "999", portugueseFileId: null }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      app.importFrom({
        userId: "ana",
        episodeId: "ep-1",
        englishFileId: "fake-pt-1",
        portugueseFileId: null,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      app.importFrom({
        userId: "ana",
        episodeId: "ep-sem-tmdb",
        englishFileId: "fake-en-1",
        portugueseFileId: null,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(fake().calls.download).toBe(0);
  });

  it("não troca a legenda de um episódio que já tem outra versão", async () => {
    await app.importFrom({
      userId: "ana",
      episodeId: "ep-1",
      englishFileId: "fake-en-1",
      portugueseFileId: null,
    });
    await expect(
      app.importFrom({
        userId: "ana",
        episodeId: "ep-1",
        englishFileId: "fake-en-2",
        portugueseFileId: null,
      }),
    ).rejects.toMatchObject({ code: "SUBTITLE_VERSION_CONFLICT" });
    expect(fake().calls.download).toBe(1);
  });

  it("avisa quando a cota acaba e não importa nada pela metade", async () => {
    for (let used = 0; used < 10; used += 1) await fake().download("fake-en-1");
    await expect(
      app.importFrom({
        userId: "ana",
        episodeId: "ep-1",
        englishFileId: "fake-en-1",
        portugueseFileId: "fake-pt-1",
      }),
    ).rejects.toMatchObject({ code: "SUBTITLE_SOURCE_QUOTA" });
    expect(app.imported).toEqual([]);
  });
});

describe("cota conhecida", () => {
  it("não gasta download quando a cota conhecida não cobre o pedido e esquece a cota depois de um dia", async () => {
    const app = setup();
    const fake = app.provider as FakeSubtitleSourceProvider;
    await app.search({ episodeId: "ep-1" });
    await app.sources.saveQuota("fake", { remaining: 1, resetAt: null }, app.clock.now());
    await expect(
      app.importFrom({
        userId: "ana",
        episodeId: "ep-1",
        englishFileId: "fake-en-1",
        portugueseFileId: "fake-pt-1",
      }),
    ).rejects.toMatchObject({ code: "SUBTITLE_SOURCE_QUOTA" });
    expect(fake.calls.download).toBe(0);

    app.clock.advanceMs(25 * 3_600_000);
    expect((await app.search({ episodeId: "ep-1" })).quota).toBeNull();
  });

  it("guarda cota zerada quando a fonte recusa por limite e respeita o horário de renovação", async () => {
    const app = setup();
    const fake = app.provider as FakeSubtitleSourceProvider;
    await app.search({ episodeId: "ep-1" });
    for (let used = 0; used < 10; used += 1) await fake.download("fake-en-1");
    await expect(
      app.importFrom({
        userId: "ana",
        episodeId: "ep-1",
        englishFileId: "fake-en-1",
        portugueseFileId: null,
      }),
    ).rejects.toMatchObject({ code: "SUBTITLE_SOURCE_QUOTA" });
    expect((await app.search({ episodeId: "ep-1" })).quota).toEqual({ remaining: 0, resetAt: null });

    await app.sources.saveQuota(
      "fake",
      { remaining: 0, resetAt: new Date("2026-10-11T13:00:00Z") },
      app.clock.now(),
    );
    app.clock.advanceMs(2 * 3_600_000);
    expect((await app.search({ episodeId: "ep-1" })).quota).toBeNull();
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
    await app.search({ episodeId: "ep-1" });
    await app.search({ episodeId: "ep-2" });
    const pair = { englishFileId: "fake-en-1", portugueseFileId: "fake-pt-1" };
    const results = await Promise.allSettled([
      app.importFrom({ userId: "ana", episodeId: "ep-1", ...pair }),
      app.importFrom({ userId: "ana", episodeId: "ep-2", ...pair }),
    ]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected"]);
    expect(results[1]).toMatchObject({ reason: { code: "SUBTITLE_SOURCE_QUOTA" } });
    expect(fake.calls.download).toBe(2);

    const other = await app.importFrom({ userId: "lucas", episodeId: "ep-2", ...pair });
    expect(other.downloadsUsed).toBe(2);
  });

  it("buscar de novo em seguida não repete a chamada à fonte", async () => {
    const app = setup();
    const fake = app.provider as FakeSubtitleSourceProvider;
    await app.search({ episodeId: "ep-1" });
    expect((await app.search({ episodeId: "ep-1", refresh: true })).cached).toBe(true);
    expect(fake.calls.search).toBe(1);
    app.clock.advanceMs((REFRESH_INTERVAL_MINUTES + 1) * 60_000);
    expect((await app.search({ episodeId: "ep-1", refresh: true })).cached).toBe(false);
    expect(fake.calls.search).toBe(2);
  });
});

describe("contabilidade que não deixa escapar", () => {
  it("conta o download mesmo quando a importação falha depois de baixar", async () => {
    const app = setup({ userDailyDownloads: 2, failImport: true });
    const fake = app.provider as FakeSubtitleSourceProvider;
    await app.search({ episodeId: "ep-1" });
    const pair = {
      userId: "ana",
      episodeId: "ep-1",
      englishFileId: "fake-en-1",
      portugueseFileId: "fake-pt-1",
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
      app.search({ episodeId: "ep-1", refresh: true }),
      app.search({ episodeId: "ep-1", refresh: true }),
      app.search({ episodeId: "ep-1" }),
    ]);
    expect(fake.calls.search).toBe(1);
  });
});
