import { describe, expect, it } from "vitest";
import { LRCLIB_USER_AGENT, LrclibLyricsProvider } from "./lrclib-lyrics-provider";

const entry = {
  id: 7,
  trackName: "Morning Window",
  artistName: "Lanterna Azul",
  albumName: "Small Rooms",
  duration: 52.4,
  instrumental: false,
  plainLyrics: "x",
  syncedLyrics: "[00:01.00]x",
};

function provider(
  responses: (Response | Error)[],
  seen: { url: string; headers: HeadersInit | undefined }[] = [],
) {
  const queue = [...responses];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), headers: init?.headers });
    const next = queue.shift();
    if (!next) throw new Error("sem resposta");
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
  return new LrclibLyricsProvider({ baseUrl: "https://lrclib.test/api", fetchImpl, retryDelayMs: 0 });
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("LrclibLyricsProvider", () => {
  it("busca por artista e título, com User-Agent sem e-mail, sincronizadas primeiro", async () => {
    const seen: { url: string; headers: HeadersInit | undefined }[] = [];
    const lrclib = provider(
      [json([{ ...entry, id: 1, syncedLyrics: null }, entry, { id: 9, trackName: null }])],
      seen,
    );
    const results = await lrclib.search({ artist: "Lanterna Azul", title: "Morning Window" });
    expect(results.map((result) => [result.id, result.synced])).toEqual([
      ["7", true],
      ["1", false],
    ]);
    expect(results[0]).toMatchObject({ durationMs: 52_400, album: "Small Rooms" });
    expect(seen[0]?.url).toBe(
      "https://lrclib.test/api/search?artist_name=Lanterna+Azul&track_name=Morning+Window",
    );
    const agent = (seen[0]?.headers as Record<string, string>)["User-Agent"];
    expect(agent).toBe(LRCLIB_USER_AGENT);
    expect(agent).not.toContain("@");
  });

  it("busca livre usa q e busca vazia não chama a rede", async () => {
    const seen: { url: string; headers: HeadersInit | undefined }[] = [];
    const lrclib = provider([json([])], seen);
    expect(await lrclib.search({})).toEqual([]);
    expect(seen).toHaveLength(0);
    await lrclib.search({ query: "morning" });
    expect(seen[0]?.url).toContain("?q=morning");
  });

  it("lê a letra completa por id e devolve nulo no 404", async () => {
    const lrclib = provider([json(entry), json({ message: "x" }, 404)]);
    expect(await lrclib.get("7")).toMatchObject({ id: "7", syncedLrc: "[00:01.00]x", synced: true });
    expect(await lrclib.get("8")).toBeNull();
    expect(await lrclib.get("abc")).toBeNull();
  });

  it("tenta de novo uma vez e depois vira erro tratável", async () => {
    const recovered = provider([new Error("rede"), json([entry])]);
    expect(await recovered.search({ query: "x" })).toHaveLength(1);
    const down = provider([json({}, 503), json({}, 503)]);
    await expect(down.search({ query: "x" })).rejects.toMatchObject({ code: "MUSIC_PROVIDER_UNAVAILABLE" });
  });

  it("resposta fora do formato vira erro tratável", async () => {
    const lrclib = provider([json({ nope: true })]);
    await expect(lrclib.search({ query: "x" })).rejects.toMatchObject({ code: "MUSIC_PROVIDER_UNAVAILABLE" });
  });
});
