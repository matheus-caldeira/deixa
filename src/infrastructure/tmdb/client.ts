import type { z } from "zod";
import { AppError } from "@/shared/errors";

const BASE_URL = "https://api.themoviedb.org/3";
const TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 2000;
const DEFAULT_RETRY_DELAY_MS = 400;
const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const TOO_MANY_REQUESTS = 429;
const SERVER_ERROR = 500;

export type TmdbCredentials = { readAccessToken?: string; apiKey?: string };
export type TmdbFetch = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<Response>;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function retryDelayMs(response: Response): number {
  const seconds = Number(response.headers.get("retry-after"));
  const requested = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DEFAULT_RETRY_DELAY_MS;
  return Math.min(requested, MAX_RETRY_DELAY_MS);
}

export class TmdbClient {
  constructor(
    private readonly credentials: TmdbCredentials,
    private readonly fetcher: TmdbFetch = fetch,
    private readonly wait: (ms: number) => Promise<void> = sleep,
  ) {}

  private buildRequest(path: string, params: Record<string, string>, mode: "bearer" | "apiKey") {
    const url = new URL(`${BASE_URL}/${path}`);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    const headers: Record<string, string> = { accept: "application/json" };
    if (mode === "bearer") headers.authorization = `Bearer ${this.credentials.readAccessToken}`;
    else url.searchParams.set("api_key", this.credentials.apiKey ?? "");
    return { url: url.toString(), headers };
  }

  private async send(
    path: string,
    params: Record<string, string>,
    mode: "bearer" | "apiKey",
  ): Promise<Response> {
    for (let attempt = 0; ; attempt += 1) {
      const { url, headers } = this.buildRequest(path, params, mode);
      let response: Response;
      try {
        response = await this.fetcher(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
      } catch {
        if (attempt >= MAX_RETRIES)
          throw new AppError("METADATA_UNAVAILABLE", `TMDB sem resposta em ${path}`);
        await this.wait(DEFAULT_RETRY_DELAY_MS);
        continue;
      }
      const shouldRetry = response.status === TOO_MANY_REQUESTS || response.status >= SERVER_ERROR;
      if (!shouldRetry || attempt >= MAX_RETRIES) return response;
      await this.wait(retryDelayMs(response));
    }
  }

  async get<Schema extends z.ZodType>(
    path: string,
    params: Record<string, string>,
    schema: Schema,
  ): Promise<z.infer<Schema>> {
    const hasToken = Boolean(this.credentials.readAccessToken);
    const hasKey = Boolean(this.credentials.apiKey);
    if (!hasToken && !hasKey) throw new AppError("METADATA_UNAUTHORIZED", "TMDB sem credenciais");

    let response = await this.send(path, params, hasToken ? "bearer" : "apiKey");
    if (response.status === UNAUTHORIZED && hasToken && hasKey)
      response = await this.send(path, params, "apiKey");

    if (response.status === UNAUTHORIZED)
      throw new AppError("METADATA_UNAUTHORIZED", `TMDB recusou as credenciais em ${path}`);
    if (response.status === NOT_FOUND) throw new AppError("METADATA_NOT_FOUND");
    if (!response.ok)
      throw new AppError("METADATA_UNAVAILABLE", `TMDB respondeu ${response.status} em ${path}`);

    const parsed = schema.safeParse(await response.json());
    if (!parsed.success)
      throw new AppError("METADATA_UNAVAILABLE", `TMDB devolveu formato inesperado em ${path}`);
    return parsed.data;
  }
}
