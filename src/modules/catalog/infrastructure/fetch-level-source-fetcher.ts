import { MAX_LEVEL_SOURCE_BYTES } from "../domain/level-ratings";
import type { LevelFetchResult, LevelSourceFetcher } from "../application/level-sources";

const TIMEOUT_MS = 15_000;

export class FetchLevelSourceFetcher implements LevelSourceFetcher {
  async fetchJson(url: string): Promise<LevelFetchResult> {
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), credentials: "omit" });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      return { ok: false, reason: timedOut ? "timeout" : "unreachable", status: null };
    }
    if (!response.ok) return { ok: false, reason: "status", status: response.status };
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_LEVEL_SOURCE_BYTES) return { ok: false, reason: "tooLarge", status: response.status };
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_LEVEL_SOURCE_BYTES)
      return { ok: false, reason: "tooLarge", status: response.status };
    try {
      return { ok: true, data: JSON.parse(new TextDecoder().decode(bytes)) };
    } catch {
      return { ok: false, reason: "notJson", status: response.status };
    }
  }
}
