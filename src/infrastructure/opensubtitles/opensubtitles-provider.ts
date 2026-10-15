import {
  SourceQuotaExceeded,
  type SourceLanguage,
  type SourceQuery,
  type SourceQuota,
  type SubtitleCandidate,
  type SubtitleSourceProvider,
} from "@/modules/subtitle-sources";
import { AppError } from "@/shared/errors";
import { normalizeLanguageTag } from "@/shared/study-languages";
import { downloadSchema, loginSchema, quotaSchema, searchSchema, type SearchResponse } from "./schemas";

const BASE_URL = "https://api.opensubtitles.com/api/v1";
const USER_AGENT = "Deixa v0.1";
const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 600;
const MAX_RETRY_DELAY_MS = 2000;
const MAX_SUBTITLE_BYTES = 5_000_000;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_ACCEPTABLE = 406;
const TOO_MANY_REQUESTS = 429;
const SERVER_ERROR = 500;
const ALLOWED_DOWNLOAD_HOST = /(^|\.)opensubtitles\.(com|org)$/;

export type OpenSubtitlesCredentials = { apiKey: string; username?: string; password?: string };
export type OpenSubtitlesFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal: AbortSignal },
) => Promise<Response>;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const toLanguage = (value: string): SourceLanguage | null => normalizeLanguageTag(value);

const toRequestTag = (language: SourceLanguage): string => language.toLowerCase();

export function mapSearchResponse(response: SearchResponse): SubtitleCandidate[] {
  const candidates: SubtitleCandidate[] = [];
  const seen = new Set<string>();
  for (const { attributes } of response.data) {
    const language = toLanguage(attributes.language);
    const file = attributes.files.length === 1 ? attributes.files[0] : undefined;
    if (!language || !file) continue;
    const fileId = String(file.file_id);
    if (!/^\d+$/.test(fileId) || seen.has(fileId)) continue;
    seen.add(fileId);
    candidates.push({
      fileId,
      language,
      release: attributes.release.trim(),
      fileName: file.file_name.trim() || `${fileId}.srt`,
      downloads: attributes.download_count ?? 0,
      rating: attributes.ratings ?? 0,
      hearingImpaired: attributes.hearing_impaired,
      machineTranslated: attributes.ai_translated || attributes.machine_translated,
      fps: attributes.fps && attributes.fps > 0 ? attributes.fps : null,
      uploader: attributes.uploader.name.trim() || null,
    });
  }
  return candidates;
}

function toQuota(remaining: number | undefined, resetTime: string | undefined): SourceQuota | null {
  if (remaining === undefined) return null;
  const resetAt = resetTime ? new Date(resetTime) : null;
  return {
    remaining: Math.max(0, Math.trunc(remaining)),
    resetAt: resetAt && !Number.isNaN(resetAt.getTime()) ? resetAt : null,
  };
}

function searchParams(query: SourceQuery, languages: readonly SourceLanguage[]): Record<string, string> {
  const requested = [...new Set(languages.map(toRequestTag))].sort().join(",");
  if (query.kind === "movie") return { languages: requested, tmdb_id: query.tmdbId };
  return {
    episode_number: String(query.episodeNumber),
    languages: requested,
    parent_tmdb_id: query.showTmdbId,
    season_number: String(query.seasonNumber),
  };
}

export class OpenSubtitlesProvider implements SubtitleSourceProvider {
  readonly name = "opensubtitles" as const;
  private token: string | null = null;

  constructor(
    private readonly credentials: OpenSubtitlesCredentials,
    private readonly fetcher: OpenSubtitlesFetch = fetch,
    private readonly wait: (ms: number) => Promise<void> = sleep,
  ) {}

  private headers(withToken: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      accept: "application/json",
      "api-key": this.credentials.apiKey,
      "user-agent": USER_AGENT,
    };
    if (withToken && this.token) headers.authorization = `Bearer ${this.token}`;
    return headers;
  }

  private async send(
    method: "GET" | "POST",
    url: string,
    body: Record<string, unknown> | undefined,
    withToken: boolean,
  ): Promise<Response> {
    for (let attempt = 0; ; attempt += 1) {
      const headers = this.headers(withToken);
      if (body) headers["content-type"] = "application/json";
      let response: Response;
      try {
        response = await this.fetcher(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        if (attempt >= MAX_RETRIES) {
          throw new AppError("SUBTITLE_SOURCE_UNAVAILABLE", "OpenSubtitles sem resposta.");
        }
        await this.wait(RETRY_DELAY_MS);
        continue;
      }
      const shouldRetry = response.status === TOO_MANY_REQUESTS || response.status >= SERVER_ERROR;
      if (!shouldRetry || attempt >= MAX_RETRIES) return response;
      const seconds = Number(response.headers.get("retry-after"));
      const requested = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : RETRY_DELAY_MS;
      await this.wait(Math.min(requested, MAX_RETRY_DELAY_MS));
    }
  }

  private failure(response: Response): AppError {
    if (response.status === UNAUTHORIZED || response.status === FORBIDDEN) {
      return new AppError("SUBTITLE_SOURCE_UNAVAILABLE", "OpenSubtitles recusou a credencial do servidor.");
    }
    if (response.status === TOO_MANY_REQUESTS) {
      return new AppError(
        "SUBTITLE_SOURCE_UNAVAILABLE",
        "OpenSubtitles pediu para esperar. Tente de novo em instantes.",
      );
    }
    return new AppError("SUBTITLE_SOURCE_UNAVAILABLE", `OpenSubtitles respondeu ${response.status}.`);
  }

  private async login(): Promise<void> {
    const { username, password } = this.credentials;
    if (!username || !password) return;
    const response = await this.send("POST", `${BASE_URL}/login`, { username, password }, false);
    if (!response.ok) throw this.failure(response);
    const parsed = loginSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      throw new AppError("SUBTITLE_SOURCE_UNAVAILABLE", "OpenSubtitles devolveu um login inesperado.");
    }
    this.token = parsed.data.token;
  }

  async search(query: SourceQuery, languages: readonly SourceLanguage[]): Promise<SubtitleCandidate[]> {
    const url = new URL(`${BASE_URL}/subtitles`);
    for (const [name, value] of Object.entries(searchParams(query, languages)))
      url.searchParams.set(name, value);
    const response = await this.send("GET", url.toString(), undefined, false);
    if (!response.ok) throw this.failure(response);
    const parsed = searchSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      throw new AppError("SUBTITLE_SOURCE_UNAVAILABLE", "OpenSubtitles devolveu uma busca inesperada.");
    }
    return mapSearchResponse(parsed.data);
  }

  private async requestLink(fileId: string): Promise<Response> {
    const body = { file_id: Number(fileId), sub_format: "srt" };
    if (!this.token) await this.login();
    const response = await this.send("POST", `${BASE_URL}/download`, body, true);
    if (response.status !== UNAUTHORIZED || !this.token) return response;
    this.token = null;
    await this.login();
    return this.send("POST", `${BASE_URL}/download`, body, true);
  }

  private async fetchFile(link: string): Promise<Uint8Array> {
    let target: URL;
    try {
      target = new URL(link);
    } catch {
      throw new AppError("SUBTITLE_SOURCE_UNAVAILABLE", "sourceLinkInvalid");
    }
    if (target.protocol !== "https:" || !ALLOWED_DOWNLOAD_HOST.test(target.hostname)) {
      throw new AppError("SUBTITLE_SOURCE_UNAVAILABLE", "sourceLinkInvalid");
    }
    let response: Response;
    try {
      response = await this.fetcher(target.toString(), {
        method: "GET",
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new AppError("SUBTITLE_SOURCE_UNAVAILABLE", "sourceFileSilent");
    }
    if (!response.ok) throw this.failure(response);
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_SUBTITLE_BYTES) {
      throw new AppError("SUBTITLE_INVALID", "A legenda baixada passa de 5 MB.");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_SUBTITLE_BYTES) {
      throw new AppError("SUBTITLE_INVALID", "A legenda baixada passa de 5 MB.");
    }
    return bytes;
  }

  async download(
    fileId: string,
  ): Promise<{ bytes: Uint8Array; fileName: string; quota: SourceQuota | null }> {
    if (!/^\d+$/.test(fileId)) throw new AppError("INVALID_INPUT");
    const response = await this.requestLink(fileId);
    if (response.status === NOT_ACCEPTABLE) {
      const parsed = quotaSchema.safeParse(await response.json().catch(() => null));
      const known = parsed.success ? toQuota(parsed.data.remaining ?? 0, parsed.data.reset_time_utc) : null;
      throw new SourceQuotaExceeded(known ? { ...known, remaining: 0 } : null);
    }
    if (!response.ok) throw this.failure(response);
    const parsed = downloadSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      throw new AppError("SUBTITLE_SOURCE_UNAVAILABLE", "OpenSubtitles devolveu um download inesperado.");
    }
    const quota = toQuota(parsed.data.remaining, parsed.data.reset_time_utc);
    const bytes = await this.fetchFile(parsed.data.link);
    return { bytes, fileName: parsed.data.file_name.trim(), quota };
  }
}
