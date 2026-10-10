import { describe, expect, it } from "vitest";
import { z } from "zod";
import { TmdbClient, type TmdbFetch } from "./client";

const schema = z.object({ ok: z.boolean() });
const noWait = async (): Promise<void> => undefined;

function scripted(responses: (Response | Error)[]) {
  const calls: { url: string; authorization: string | undefined }[] = [];
  const fetcher: TmdbFetch = async (url, init) => {
    calls.push({ url, authorization: init.headers.authorization });
    const next = responses.shift();
    if (!next) throw new Error("sem resposta roteirizada");
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetcher, calls };
}

const json = (status: number, body: unknown, headers?: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers });

describe("cliente do TMDB", () => {
  it("usa o token v4 no header Authorization e não põe a chave na URL", async () => {
    const { fetcher, calls } = scripted([json(200, { ok: true })]);
    const client = new TmdbClient({ readAccessToken: "TOKEN_V4", apiKey: "KEY_V3" }, fetcher, noWait);
    expect(await client.get("search/multi", { query: "friends", language: "pt-BR" }, schema)).toEqual({
      ok: true,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.authorization).toBe("Bearer TOKEN_V4");
    expect(calls[0]?.url).toContain("language=pt-BR");
    expect(calls[0]?.url).not.toContain("KEY_V3");
  });

  it("cai para a chave v3 quando o token é recusado", async () => {
    const { fetcher, calls } = scripted([json(401, {}), json(200, { ok: true })]);
    const client = new TmdbClient({ readAccessToken: "TOKEN_V4", apiKey: "KEY_V3" }, fetcher, noWait);
    expect(await client.get("tv/1", {}, schema)).toEqual({ ok: true });
    expect(calls[1]?.authorization).toBeUndefined();
    expect(calls[1]?.url).toContain("api_key=KEY_V3");
  });

  it("devolve erro de credencial em 401 sem expor o segredo na mensagem", async () => {
    const { fetcher } = scripted([json(401, {})]);
    const client = new TmdbClient({ readAccessToken: "TOKEN_V4" }, fetcher, noWait);
    const failure = await client.get("tv/1", {}, schema).catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: "METADATA_UNAUTHORIZED" });
    expect(String((failure as Error).message)).not.toContain("TOKEN_V4");
  });

  it("tenta de novo em 429 e em falha de rede, com limite", async () => {
    const retried = scripted([
      json(429, {}, { "retry-after": "1" }),
      new Error("rede"),
      json(200, { ok: true }),
    ]);
    const client = new TmdbClient({ readAccessToken: "T" }, retried.fetcher, noWait);
    expect(await client.get("tv/1", {}, schema)).toEqual({ ok: true });
    expect(retried.calls).toHaveLength(3);

    const exhausted = scripted([json(429, {}), json(429, {}), json(429, {})]);
    const limited = new TmdbClient({ readAccessToken: "T" }, exhausted.fetcher, noWait);
    await expect(limited.get("tv/1", {}, schema)).rejects.toMatchObject({ code: "METADATA_UNAVAILABLE" });
    expect(exhausted.calls).toHaveLength(3);
  });

  it("distingue obra inexistente, formato inesperado e falta de credenciais", async () => {
    const notFound = new TmdbClient({ readAccessToken: "T" }, scripted([json(404, {})]).fetcher, noWait);
    await expect(notFound.get("tv/0", {}, schema)).rejects.toMatchObject({ code: "METADATA_NOT_FOUND" });
    const odd = new TmdbClient(
      { readAccessToken: "T" },
      scripted([json(200, { ok: "talvez" })]).fetcher,
      noWait,
    );
    await expect(odd.get("tv/1", {}, schema)).rejects.toMatchObject({ code: "METADATA_UNAVAILABLE" });
    const empty = new TmdbClient({}, scripted([]).fetcher, noWait);
    await expect(empty.get("tv/1", {}, schema)).rejects.toMatchObject({ code: "METADATA_UNAUTHORIZED" });
  });
});
