import { AppError } from "@/shared/errors";
import type { ProcessingStep } from "@/modules/subtitles";
import type { Clock } from "@/shared/clock";
import { rankCandidates, type Ranking, type SourceLanguage, type SubtitleCandidate } from "../domain/ranking";

export type SourceProviderName = "opensubtitles" | "fake";
export type SourceQuery =
  | { kind: "episode"; showTmdbId: string; seasonNumber: number; episodeNumber: number }
  | { kind: "movie"; tmdbId: string };
export type SourceQuota = { remaining: number; resetAt: Date | null };

const QUOTA_MESSAGE = "A cota de downloads de hoje acabou. Envie o arquivo manualmente ou tente depois.";

export class SourceQuotaExceeded extends AppError {
  constructor(readonly quota: SourceQuota | null) {
    super("SUBTITLE_SOURCE_QUOTA", QUOTA_MESSAGE);
  }
}

export interface SubtitleSourceProvider {
  readonly name: SourceProviderName;
  search(query: SourceQuery): Promise<SubtitleCandidate[]>;
  download(fileId: string): Promise<{ bytes: Uint8Array; fileName: string; quota: SourceQuota | null }>;
}

export interface SourceRepository {
  getCachedSearch(
    episodeId: string,
    provider: SourceProviderName,
  ): Promise<{ candidates: SubtitleCandidate[]; fetchedAt: Date } | null>;
  saveSearch(
    episodeId: string,
    provider: SourceProviderName,
    candidates: SubtitleCandidate[],
    now: Date,
  ): Promise<void>;
  getQuota(quotaKey: string): Promise<(SourceQuota & { updatedAt: Date }) | null>;
  saveQuota(quotaKey: string, quota: SourceQuota, now: Date): Promise<void>;
  recordDownload(userId: string, provider: SourceProviderName, fileId: string, now: Date): Promise<void>;
  countUserDownloads(userId: string, provider: SourceProviderName, since: Date): Promise<number>;
}

export type EpisodeSource = {
  episodeId: string;
  query: SourceQuery | null;
  existing: { language: SourceLanguage; externalFileId: string | null }[];
};

export type ImportedFile = {
  filename: string;
  bytes: Uint8Array;
  origin: {
    source: "opensubtitles";
    externalFileId: string;
    releaseName: string | null;
    author: string | null;
    hearingImpaired: boolean | null;
    fps: number | null;
  };
};

type Deps = {
  provider: SubtitleSourceProvider;
  quotaKey: string;
  sources: SourceRepository;
  findEpisodeSource: (episodeId: string) => Promise<EpisodeSource | null>;
  readExistingFile: (episodeId: string, language: SourceLanguage) => Promise<Uint8Array | null>;
  importSubtitles: (input: {
    userId: string;
    episodeId: string;
    english: ImportedFile;
    portuguese?: ImportedFile;
  }) => Promise<ImportOutcome>;
  userDailyDownloads: number;
  clock: Clock;
};

export type ImportOutcome = {
  outcome: "PROCESSED" | "DUPLICATE";
  steps: ProcessingStep[];
  hasPortuguese: boolean;
};

export const SEARCH_CACHE_HOURS = 24;
export const REFRESH_INTERVAL_MINUTES = 10;
const MS_PER_MINUTE = 60 * 1000;
const USER_WINDOW_HOURS = 24;
const QUOTA_MEMORY_HOURS = 24;
const MS_PER_HOUR = 60 * 60 * 1000;
const MAX_SUBTITLE_BYTES = 5_000_000;

export type SubtitleSearch = {
  provider: SourceProviderName;
  ranking: Ranking;
  quota: SourceQuota | null;
  cached: boolean;
};

function currentQuota(stored: (SourceQuota & { updatedAt: Date }) | null, now: Date): SourceQuota | null {
  if (!stored) return null;
  const expiresAt = stored.resetAt ?? new Date(stored.updatedAt.getTime() + QUOTA_MEMORY_HOURS * MS_PER_HOUR);
  if (expiresAt.getTime() <= now.getTime()) return null;
  return { remaining: stored.remaining, resetAt: stored.resetAt };
}

export function makeSearchSubtitles(
  deps: Pick<Deps, "provider" | "quotaKey" | "sources" | "findEpisodeSource" | "clock">,
) {
  type SearchInput = { episodeId: string; refresh?: boolean };
  const running = new Map<string, Promise<SubtitleSearch>>();

  return function searchSubtitles(input: SearchInput): Promise<SubtitleSearch> {
    const current = running.get(input.episodeId);
    if (current) return current;
    const started = searchNow(input).finally(() => running.delete(input.episodeId));
    running.set(input.episodeId, started);
    return started;
  };

  async function searchNow(input: SearchInput): Promise<SubtitleSearch> {
    const episode = await deps.findEpisodeSource(input.episodeId);
    if (!episode) throw new AppError("EPISODE_NOT_FOUND");
    const now = deps.clock.now();
    const quota = currentQuota(await deps.sources.getQuota(deps.quotaKey), now);
    const cached = await deps.sources.getCachedSearch(input.episodeId, deps.provider.name);
    const fresh = cached && now.getTime() - cached.fetchedAt.getTime() < SEARCH_CACHE_HOURS * MS_PER_HOUR;
    const recent =
      cached && now.getTime() - cached.fetchedAt.getTime() < REFRESH_INTERVAL_MINUTES * MS_PER_MINUTE;
    if (cached && (recent || (fresh && !input.refresh))) {
      return {
        provider: deps.provider.name,
        ranking: rankCandidates(cached.candidates),
        quota,
        cached: true,
      };
    }
    if (!episode.query) {
      throw new AppError("SUBTITLE_SOURCE_EMPTY", "noExternalId");
    }
    const candidates = await deps.provider.search(episode.query);
    await deps.sources.saveSearch(input.episodeId, deps.provider.name, candidates, now);
    return { provider: deps.provider.name, ranking: rankCandidates(candidates), quota, cached: false };
  }
}

export function makeImportFromSource(deps: Deps) {
  async function obtain(
    userId: string,
    episode: EpisodeSource,
    candidate: SubtitleCandidate,
    downloads: { count: number },
  ): Promise<ImportedFile> {
    const stored = episode.existing.find((file) => file.language === candidate.language);
    if (stored && stored.externalFileId !== candidate.fileId) {
      throw new AppError(
        "SUBTITLE_VERSION_CONFLICT",
        candidate.language === "en" ? "targetVersionConflict" : "nativeVersionConflict",
      );
    }
    let bytes = stored ? await deps.readExistingFile(episode.episodeId, candidate.language) : null;
    let fileName = candidate.fileName;
    if (!bytes) {
      await deps.sources.recordDownload(userId, deps.provider.name, candidate.fileId, deps.clock.now());
      const downloaded = await deps.provider.download(candidate.fileId).catch(async (error: unknown) => {
        if (error instanceof AppError && error.code === "SUBTITLE_SOURCE_QUOTA") {
          const known = error instanceof SourceQuotaExceeded ? error.quota : null;
          await deps.sources.saveQuota(
            deps.quotaKey,
            { remaining: 0, resetAt: known?.resetAt ?? null },
            deps.clock.now(),
          );
        }
        throw error;
      });
      downloads.count += 1;
      if (downloaded.quota) await deps.sources.saveQuota(deps.quotaKey, downloaded.quota, deps.clock.now());
      if (downloaded.bytes.byteLength === 0 || downloaded.bytes.byteLength > MAX_SUBTITLE_BYTES) {
        throw new AppError("SUBTITLE_INVALID", "downloadInvalid");
      }
      bytes = downloaded.bytes;
      fileName = downloaded.fileName || candidate.fileName;
    }
    return {
      filename: /\.srt$/i.test(fileName) ? fileName : `${fileName}.srt`,
      bytes,
      origin: {
        source: "opensubtitles",
        externalFileId: candidate.fileId,
        releaseName: candidate.release || null,
        author: candidate.uploader,
        hearingImpaired: candidate.hearingImpaired,
        fps: candidate.fps,
      },
    };
  }

  type Input = { userId: string; episodeId: string; englishFileId: string; portugueseFileId: string | null };
  type Output = ImportOutcome & { downloadsUsed: number; quota: SourceQuota | null };
  const queues = new Map<string, Promise<unknown>>();

  return function importFromSource(input: Input): Promise<Output> {
    const previous = queues.get(input.userId) ?? Promise.resolve();
    const run = previous.then(
      () => importNow(input),
      () => importNow(input),
    );
    const settled = run.catch(() => undefined);
    queues.set(input.userId, settled);
    void settled.then(() => {
      if (queues.get(input.userId) === settled) queues.delete(input.userId);
    });
    return run;
  };

  async function importNow(input: Input): Promise<Output> {
    const episode = await deps.findEpisodeSource(input.episodeId);
    if (!episode) throw new AppError("EPISODE_NOT_FOUND");
    const cached = await deps.sources.getCachedSearch(input.episodeId, deps.provider.name);
    const pick = (fileId: string | null, language: SourceLanguage): SubtitleCandidate | null =>
      fileId === null
        ? null
        : (cached?.candidates.find(
            (candidate) => candidate.fileId === fileId && candidate.language === language,
          ) ?? null);
    const english = pick(input.englishFileId, "en");
    const portuguese = pick(input.portugueseFileId, "pt-BR");
    if (!english || (input.portugueseFileId !== null && !portuguese)) {
      throw new AppError("INVALID_INPUT", "Busque as legendas de novo antes de importar.");
    }

    const needed = [english, portuguese].filter(
      (candidate) => candidate && !episode.existing.some((file) => file.language === candidate.language),
    ).length;
    const known = currentQuota(await deps.sources.getQuota(deps.quotaKey), deps.clock.now());
    if (known && needed > known.remaining) throw new SourceQuotaExceeded(known);
    const since = new Date(deps.clock.now().getTime() - USER_WINDOW_HOURS * MS_PER_HOUR);
    const used =
      needed > 0 ? await deps.sources.countUserDownloads(input.userId, deps.provider.name, since) : 0;
    if (used + needed > deps.userDailyDownloads) {
      throw new AppError("SUBTITLE_SOURCE_QUOTA", {
        key: "userQuota",
        params: { used, limit: deps.userDailyDownloads },
      });
    }

    const downloads = { count: 0 };
    const englishFile = await obtain(input.userId, episode, english, downloads);
    const portugueseFile = portuguese
      ? await obtain(input.userId, episode, portuguese, downloads)
      : undefined;
    const outcome = await deps.importSubtitles({
      userId: input.userId,
      episodeId: input.episodeId,
      english: englishFile,
      portuguese: portugueseFile,
    });
    const quota = currentQuota(await deps.sources.getQuota(deps.quotaKey), deps.clock.now());
    return { ...outcome, downloadsUsed: downloads.count, quota };
  }
}
