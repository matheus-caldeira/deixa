import { AppError } from "@/shared/errors";
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
  getQuota(provider: SourceProviderName): Promise<(SourceQuota & { updatedAt: Date }) | null>;
  saveQuota(provider: SourceProviderName, quota: SourceQuota, now: Date): Promise<void>;
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
  sources: SourceRepository;
  findEpisodeSource: (episodeId: string) => Promise<EpisodeSource | null>;
  readExistingFile: (episodeId: string, language: SourceLanguage) => Promise<Uint8Array | null>;
  importSubtitles: (input: {
    userId: string;
    episodeId: string;
    english: ImportedFile;
    portuguese?: ImportedFile;
  }) => Promise<ImportOutcome>;
  clock: Clock;
};

export type ImportOutcome = {
  outcome: "PROCESSED" | "DUPLICATE";
  steps: { label: string; detail: string }[];
  hasPortuguese: boolean;
};

export const SEARCH_CACHE_HOURS = 24;
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
  deps: Pick<Deps, "provider" | "sources" | "findEpisodeSource" | "clock">,
) {
  return async function searchSubtitles(input: {
    episodeId: string;
    refresh?: boolean;
  }): Promise<SubtitleSearch> {
    const episode = await deps.findEpisodeSource(input.episodeId);
    if (!episode) throw new AppError("EPISODE_NOT_FOUND");
    const now = deps.clock.now();
    const quota = currentQuota(await deps.sources.getQuota(deps.provider.name), now);
    const cached = await deps.sources.getCachedSearch(input.episodeId, deps.provider.name);
    const fresh = cached && now.getTime() - cached.fetchedAt.getTime() < SEARCH_CACHE_HOURS * MS_PER_HOUR;
    if (cached && fresh && !input.refresh) {
      return {
        provider: deps.provider.name,
        ranking: rankCandidates(cached.candidates),
        quota,
        cached: true,
      };
    }
    if (!episode.query) {
      throw new AppError(
        "SUBTITLE_SOURCE_EMPTY",
        "Esta obra não tem identificador do TMDB para buscar legendas.",
      );
    }
    const candidates = await deps.provider.search(episode.query);
    await deps.sources.saveSearch(input.episodeId, deps.provider.name, candidates, now);
    return { provider: deps.provider.name, ranking: rankCandidates(candidates), quota, cached: false };
  };
}

export function makeImportFromSource(deps: Deps) {
  async function obtain(
    episode: EpisodeSource,
    candidate: SubtitleCandidate,
    downloads: { count: number },
  ): Promise<ImportedFile> {
    const stored = episode.existing.find((file) => file.language === candidate.language);
    if (stored && stored.externalFileId !== candidate.fileId) {
      throw new AppError(
        "SUBTITLE_VERSION_CONFLICT",
        candidate.language === "en"
          ? "Este episódio já tem uma legenda em inglês diferente. A troca de versão ainda não é suportada."
          : "Este episódio já tem uma legenda em português diferente. A troca de versão ainda não é suportada.",
      );
    }
    let bytes = stored ? await deps.readExistingFile(episode.episodeId, candidate.language) : null;
    let fileName = candidate.fileName;
    if (!bytes) {
      const downloaded = await deps.provider.download(candidate.fileId).catch(async (error: unknown) => {
        if (error instanceof AppError && error.code === "SUBTITLE_SOURCE_QUOTA") {
          const known = error instanceof SourceQuotaExceeded ? error.quota : null;
          await deps.sources.saveQuota(
            deps.provider.name,
            { remaining: 0, resetAt: known?.resetAt ?? null },
            deps.clock.now(),
          );
        }
        throw error;
      });
      downloads.count += 1;
      if (downloaded.quota)
        await deps.sources.saveQuota(deps.provider.name, downloaded.quota, deps.clock.now());
      if (downloaded.bytes.byteLength === 0 || downloaded.bytes.byteLength > MAX_SUBTITLE_BYTES) {
        throw new AppError(
          "SUBTITLE_INVALID",
          "O arquivo baixado é inválido. Escolha outra opção ou envie manualmente.",
        );
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

  return async function importFromSource(input: {
    userId: string;
    episodeId: string;
    englishFileId: string;
    portugueseFileId: string | null;
  }): Promise<ImportOutcome & { downloadsUsed: number; quota: SourceQuota | null }> {
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
    const known = currentQuota(await deps.sources.getQuota(deps.provider.name), deps.clock.now());
    if (known && needed > known.remaining) throw new SourceQuotaExceeded(known);

    const downloads = { count: 0 };
    const englishFile = await obtain(episode, english, downloads);
    const portugueseFile = portuguese ? await obtain(episode, portuguese, downloads) : undefined;
    const outcome = await deps.importSubtitles({
      userId: input.userId,
      episodeId: input.episodeId,
      english: englishFile,
      portuguese: portugueseFile,
    });
    const quota = currentQuota(await deps.sources.getQuota(deps.provider.name), deps.clock.now());
    return { ...outcome, downloadsUsed: downloads.count, quota };
  };
}
