import { MAX_LEVEL_SOURCE_BYTES } from "../domain/level-ratings";
import type { LevelFetchResult, LevelSourceFetcher } from "../application/level-sources";

const TIMEOUT_MS = 15_000;

async function readCapped(response: Response): Promise<Uint8Array | null> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_LEVEL_SOURCE_BYTES) {
      void reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

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
    const bytes = await readCapped(response);
    if (!bytes) return { ok: false, reason: "tooLarge", status: response.status };
    try {
      return { ok: true, data: JSON.parse(new TextDecoder().decode(bytes)) };
    } catch {
      return { ok: false, reason: "notJson", status: response.status };
    }
  }
}
