import { z } from "zod";
import { AppError } from "@/shared/errors";
import type { LyricsCandidate, LyricsDocument, LyricsProvider, LyricsQuery } from "../application/ports";
import { MAX_SEARCH_RESULTS } from "../domain/music";

export const LRCLIB_BASE_URL = "https://lrclib.net/api";
export const LRCLIB_USER_AGENT = "Deixa (https://github.com/matheus-caldeira/deixa)";
const TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 300;
const MAX_ATTEMPTS = 2;
const MS_PER_SECOND = 1000;
const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY = 429;
const HTTP_SERVER_ERROR = 500;

const entrySchema = z.object({
  id: z.number().int(),
  trackName: z.string().nullish(),
  artistName: z.string().nullish(),
  albumName: z.string().nullish(),
  duration: z.number().nullish(),
  instrumental: z.boolean().nullish(),
  plainLyrics: z.string().nullish(),
  syncedLyrics: z.string().nullish(),
});
type Entry = z.infer<typeof entrySchema>;

function toDocument(entry: Entry): LyricsDocument {
  const synced = (entry.syncedLyrics ?? "").trim();
  return {
    id: String(entry.id),
    artist: entry.artistName?.trim() ?? "",
    title: entry.trackName?.trim() ?? "",
    album: entry.albumName?.trim() || null,
    durationMs: entry.duration ? Math.round(entry.duration * MS_PER_SECOND) : null,
    synced: synced.length > 0,
    instrumental: entry.instrumental === true,
    syncedLrc: synced.length > 0 ? synced : null,
    plain: entry.plainLyrics?.trim() || null,
  };
}

function toCandidate(document: LyricsDocument): LyricsCandidate {
  const { syncedLrc: _syncedLrc, plain: _plain, ...candidate } = document;
  return candidate;
}

type Fetch = typeof fetch;

export class LrclibLyricsProvider implements LyricsProvider {
  readonly name = "lrclib" as const;

  constructor(
    private readonly options: { baseUrl?: string; fetchImpl?: Fetch; retryDelayMs?: number } = {},
  ) {}

  private async request(path: string): Promise<Response> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const url = `${this.options.baseUrl ?? LRCLIB_BASE_URL}${path}`;
    let lastFailure: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetchImpl(url, {
          headers: { "User-Agent": LRCLIB_USER_AGENT, Accept: "application/json" },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (response.status !== HTTP_TOO_MANY && response.status < HTTP_SERVER_ERROR) return response;
        lastFailure = new Error(`status ${response.status}`);
      } catch (error) {
        lastFailure = error;
      }
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, this.options.retryDelayMs ?? RETRY_DELAY_MS));
      }
    }
    throw new AppError("MUSIC_PROVIDER_UNAVAILABLE", {
      key: "lrclib",
      params: { reason: lastFailure instanceof Error ? lastFailure.message : "unknown" },
    });
  }

  async search(query: LyricsQuery): Promise<LyricsCandidate[]> {
    const params = new URLSearchParams();
    if (query.artist?.trim()) params.set("artist_name", query.artist.trim());
    if (query.title?.trim()) params.set("track_name", query.title.trim());
    if (!params.has("track_name") && query.query?.trim()) params.set("q", query.query.trim());
    if (params.size === 0) return [];
    const response = await this.request(`/search?${params.toString()}`);
    if (!response.ok) throw new AppError("MUSIC_PROVIDER_UNAVAILABLE");
    const parsed = z.array(entrySchema).safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new AppError("MUSIC_PROVIDER_UNAVAILABLE");
    return parsed.data
      .map(toDocument)
      .filter((document) => document.title.length > 0)
      .sort((a, b) => Number(b.synced) - Number(a.synced))
      .slice(0, MAX_SEARCH_RESULTS)
      .map(toCandidate);
  }

  async get(id: string): Promise<LyricsDocument | null> {
    if (!/^\d{1,12}$/.test(id)) return null;
    const response = await this.request(`/get/${id}`);
    if (response.status === HTTP_NOT_FOUND) return null;
    if (!response.ok) throw new AppError("MUSIC_PROVIDER_UNAVAILABLE");
    const parsed = entrySchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new AppError("MUSIC_PROVIDER_UNAVAILABLE");
    return toDocument(parsed.data);
  }
}
