import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_LEVEL_SOURCE_BYTES } from "../domain/level-ratings";
import { FetchLevelSourceFetcher } from "./fetch-level-source-fetcher";

const CHUNK_BYTES = 1024 * 1024;

const TOTAL_CHUNKS = 20;

function largeStream(): { stream: ReadableStream<Uint8Array>; pulled: () => number } {
  let count = 0;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        count += 1;
        if (count > TOTAL_CHUNKS) controller.close();
        else controller.enqueue(new Uint8Array(CHUNK_BYTES));
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, pulled: () => count };
}

describe("fonte de nível baixada pelo navegador", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("para de ler quando a resposta sem tamanho declarado passa do limite", async () => {
    const { stream, pulled } = largeStream();
    vi.stubGlobal("fetch", async () => new Response(stream, { status: 200 }));
    const result = await new FetchLevelSourceFetcher().fetchJson("https://example.com/levels.json");
    expect(result).toMatchObject({ ok: false, reason: "tooLarge" });
    expect(pulled()).toBeGreaterThan(MAX_LEVEL_SOURCE_BYTES / CHUNK_BYTES);
  });

  it("lê um JSON pequeno", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ratings: {} }), { status: 200 }));
    const result = await new FetchLevelSourceFetcher().fetchJson("https://example.com/levels.json");
    expect(result).toEqual({ ok: true, data: { ratings: {} } });
  });
});
