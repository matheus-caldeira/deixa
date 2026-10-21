import type { LevelFetchResult, LevelSourceFetcher } from "../application/level-sources";
import { MAX_LEVEL_SOURCE_BYTES } from "../domain/level-ratings";

const TIMEOUT_MS = 15_000;

export class HttpLevelSourceFetcher implements LevelSourceFetcher {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async fetchJson(url: string): Promise<LevelFetchResult> {
    let response: Response;
    try {
      response = await this.fetcher(url, {
        headers: { accept: "application/json" },
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      return { ok: false, reason: timedOut ? "timeout" : "unreachable", status: null };
    }
    if (!response.ok) return { ok: false, reason: "status", status: response.status };
    if (Number(response.headers.get("content-length") ?? 0) > MAX_LEVEL_SOURCE_BYTES) {
      return { ok: false, reason: "tooLarge", status: null };
    }
    const text = await this.readLimited(response);
    if (text === null) return { ok: false, reason: "tooLarge", status: null };
    try {
      return { ok: true, data: JSON.parse(text) };
    } catch {
      return { ok: false, reason: "notJson", status: null };
    }
  }

  private async readLimited(response: Response): Promise<string | null> {
    if (!response.body) return "";
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_LEVEL_SOURCE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  }
}
