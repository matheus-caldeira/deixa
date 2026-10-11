import { describe, expect, it } from "vitest";
import { OpenSubtitlesProvider, mapSearchResponse, type OpenSubtitlesFetch } from "./opensubtitles-provider";
import { searchSchema } from "./schemas";

type Call = { url: string; method: string; headers: Record<string, string>; body?: string };
const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

function scripted(responses: (Response | Error)[]) {
  const calls: Call[] = [];
  const fetcher: OpenSubtitlesFetch = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body });
    const next = responses.shift();
    if (!next) throw new Error("sem resposta roteirizada");
    if (next instanceof Error) throw next;
    return next;
  };
  return { calls, fetcher };
}

const attributes = (overrides: Record<string, unknown>) => ({
  attributes: {
    language: "en",
    download_count: 10,
    hearing_impaired: false,
    fps: 23.976,
    ratings: 7.5,
    ai_translated: false,
    machine_translated: false,
    release: " Show.S01E01.WEB-GRP ",
    uploader: { name: "alguem" },
    files: [{ file_id: 111, file_name: "show.srt" }],
    ...overrides,
  },
});

const episode = { kind: "episode", showTmdbId: "1396", seasonNumber: 1, episodeNumber: 2 } as const;
const noWait = async () => undefined;
const SECRET = "chave-de-teste";

describe("mapeamento da busca do OpenSubtitles", () => {
  it("converte idioma, arquivo, contadores e marcações, tolerando campos nulos", () => {
    const parsed = searchSchema.parse({
      data: [
        attributes({}),
        attributes({
          language: "pt-BR",
          files: [{ file_id: "222", file_name: null }],
          uploader: null,
          fps: 0,
          ratings: null,
          ai_translated: true,
        }),
        attributes({ language: "es", files: [{ file_id: 333, file_name: "x.srt" }] }),
        attributes({
          files: [
            { file_id: 444, file_name: "cd1.srt" },
            { file_id: 445, file_name: "cd2.srt" },
          ],
        }),
        attributes({ files: [] }),
        attributes({ files: [{ file_id: 111, file_name: "repetido.srt" }] }),
      ],
    });
    expect(mapSearchResponse(parsed)).toEqual([
      {
        fileId: "111",
        language: "en",
        release: "Show.S01E01.WEB-GRP",
        fileName: "show.srt",
        downloads: 10,
        rating: 7.5,
        hearingImpaired: false,
        machineTranslated: false,
        fps: 23.976,
        uploader: "alguem",
      },
      {
        fileId: "222",
        language: "pt-BR",
        release: "Show.S01E01.WEB-GRP",
        fileName: "222.srt",
        downloads: 10,
        rating: 0,
        hearingImpaired: false,
        machineTranslated: true,
        fps: null,
        uploader: null,
      },
    ]);
    expect(mapSearchResponse(searchSchema.parse({}))).toEqual([]);
  });
});

describe("cliente do OpenSubtitles", () => {
  it("busca por episódio com os parâmetros esperados e a chave só no cabeçalho", async () => {
    const { calls, fetcher } = scripted([json(200, { data: [attributes({})] })]);
    const found = await new OpenSubtitlesProvider({ apiKey: SECRET }, fetcher, noWait).search(episode);
    expect(found).toHaveLength(1);
    const url = new URL(calls[0]?.url ?? "");
    expect(url.pathname).toBe("/api/v1/subtitles");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      episode_number: "2",
      languages: "en,pt-br",
      parent_tmdb_id: "1396",
      season_number: "1",
    });
    expect(calls[0]?.url).not.toContain(SECRET);
    expect(calls[0]?.headers["api-key"]).toBe(SECRET);
    expect(calls[0]?.headers["user-agent"]).toMatch(/^Deixa v/);
  });

  it("busca filme pelo identificador do TMDB", async () => {
    const { calls, fetcher } = scripted([json(200, { data: [] })]);
    await new OpenSubtitlesProvider({ apiKey: SECRET }, fetcher, noWait).search({
      kind: "movie",
      tmdbId: "37799",
    });
    expect(Object.fromEntries(new URL(calls[0]?.url ?? "").searchParams)).toEqual({
      languages: "en,pt-br",
      tmdb_id: "37799",
    });
  });

  it("tenta de novo em 429 e em falha de rede, e desiste com erro que não vaza a chave", async () => {
    const retried = scripted([
      json(429, {}, { "retry-after": "1" }),
      new Error("rede"),
      json(200, { data: [] }),
    ]);
    await expect(
      new OpenSubtitlesProvider({ apiKey: SECRET }, retried.fetcher, noWait).search(episode),
    ).resolves.toEqual([]);
    expect(retried.calls).toHaveLength(3);

    const down = scripted([json(503, {}), json(503, {}), json(503, {})]);
    const failure = await new OpenSubtitlesProvider({ apiKey: SECRET }, down.fetcher, noWait)
      .search(episode)
      .catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: "SUBTITLE_SOURCE_UNAVAILABLE" });
    expect(String((failure as Error).message)).not.toContain(SECRET);
  });

  it("trata 401 como credencial recusada e resposta fora do formato como indisponível", async () => {
    const denied = scripted([json(401, { message: "invalid" })]);
    await expect(
      new OpenSubtitlesProvider({ apiKey: SECRET }, denied.fetcher, noWait).search(episode),
    ).rejects.toMatchObject({ code: "SUBTITLE_SOURCE_UNAVAILABLE" });
    const odd = scripted([json(200, { data: "x" })]);
    await expect(
      new OpenSubtitlesProvider({ apiKey: SECRET }, odd.fetcher, noWait).search(episode),
    ).rejects.toMatchObject({ code: "SUBTITLE_SOURCE_UNAVAILABLE" });
  });

  it("baixa em dois passos, sem login quando só há chave, e devolve a cota", async () => {
    const { calls, fetcher } = scripted([
      json(200, {
        link: "https://www.opensubtitles.com/download/abc/arquivo.srt",
        file_name: "arquivo.srt",
        remaining: 9,
        reset_time_utc: "2026-10-12T00:00:00.000Z",
      }),
      new Response("1\n00:00:01,000 --> 00:00:02,000\nHi\n", { status: 200 }),
    ]);
    const result = await new OpenSubtitlesProvider({ apiKey: SECRET }, fetcher, noWait).download("111");
    expect(new TextDecoder().decode(result.bytes)).toContain("Hi");
    expect(result).toMatchObject({
      fileName: "arquivo.srt",
      quota: { remaining: 9, resetAt: new Date("2026-10-12T00:00:00.000Z") },
    });
    expect(calls.map((call) => `${call.method} ${new URL(call.url).pathname}`)).toEqual([
      "POST /api/v1/download",
      "GET /download/abc/arquivo.srt",
    ]);
    expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({ file_id: 111, sub_format: "srt" });
    expect(calls[0]?.headers.authorization).toBeUndefined();
    expect(calls[1]?.headers["api-key"]).toBeUndefined();
  });

  it("com usuário e senha, entra uma vez, reaproveita o token e refaz o login em 401", async () => {
    const link = { link: "https://dl.opensubtitles.org/x.srt", file_name: "x.srt", remaining: 5 };
    const { calls, fetcher } = scripted([
      json(200, { token: "t1" }),
      json(200, link),
      new Response("a", { status: 200 }),
      json(401, {}),
      json(200, { token: "t2" }),
      json(200, link),
      new Response("b", { status: 200 }),
    ]);
    const provider = new OpenSubtitlesProvider(
      { apiKey: SECRET, username: "u", password: "p" },
      fetcher,
      noWait,
    );
    await provider.download("111");
    await provider.download("112");
    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      "/api/v1/login",
      "/api/v1/download",
      "/x.srt",
      "/api/v1/download",
      "/api/v1/login",
      "/api/v1/download",
      "/x.srt",
    ]);
    expect(calls[1]?.headers.authorization).toBe("Bearer t1");
    expect(calls[5]?.headers.authorization).toBe("Bearer t2");
  });

  it("avisa cota esgotada em 406 com o horário de renovação", async () => {
    const { fetcher } = scripted([json(406, { remaining: 0, reset_time_utc: "2026-10-12T00:00:00.000Z" })]);
    await expect(
      new OpenSubtitlesProvider({ apiKey: SECRET }, fetcher, noWait).download("111"),
    ).rejects.toMatchObject({
      code: "SUBTITLE_SOURCE_QUOTA",
      quota: { remaining: 0, resetAt: new Date("2026-10-12T00:00:00.000Z") },
    });
  });

  it("recusa link fora do domínio, arquivo grande demais e identificador estranho", async () => {
    const outside = scripted([json(200, { link: "https://exemplo.test/x.srt", file_name: "x.srt" })]);
    await expect(
      new OpenSubtitlesProvider({ apiKey: SECRET }, outside.fetcher, noWait).download("111"),
    ).rejects.toMatchObject({ code: "SUBTITLE_SOURCE_UNAVAILABLE" });
    expect(outside.calls).toHaveLength(1);

    const huge = scripted([
      json(200, { link: "https://www.opensubtitles.com/x.srt", file_name: "x.srt" }),
      new Response("x", { status: 200, headers: { "content-length": "9000000" } }),
    ]);
    await expect(
      new OpenSubtitlesProvider({ apiKey: SECRET }, huge.fetcher, noWait).download("111"),
    ).rejects.toMatchObject({ code: "SUBTITLE_INVALID" });

    const none = scripted([]);
    await expect(
      new OpenSubtitlesProvider({ apiKey: SECRET }, none.fetcher, noWait).download("../1"),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(none.calls).toHaveLength(0);
  });
});
