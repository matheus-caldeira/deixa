import type { CefrLevel } from "@/shared/levels";
import type {
  Episode,
  EpisodeContext,
  EpisodeStatus,
  MediaItem,
  MetadataSource,
  Season,
} from "../../domain/catalog";
import type { AiLevelRating, AiLevelRatingRepository } from "../level-sources";
import type {
  CatalogEntry,
  CatalogRepository,
  EpisodeLevelMeasurementInput,
  EpisodeLevelMeasurementRepository,
  EpisodeProgressEntry,
  EpisodeProgressRepository,
  EpisodeUpsert,
  EpisodeWithSeason,
  MediaUpsert,
  SeasonUpsert,
} from "../ports";

export class InMemoryCatalog implements CatalogRepository, EpisodeProgressRepository {
  readonly media = new Map<string, MediaItem>();
  readonly seasons = new Map<string, Season>();
  readonly episodes = new Map<string, Episode>();
  readonly progress = new Map<string, Map<string, number>>();

  async findMediaById(id: string): Promise<MediaItem | null> {
    return this.media.get(id) ?? null;
  }

  async findMediaByExternal(provider: MetadataSource, externalId: string): Promise<MediaItem | null> {
    return (
      [...this.media.values()].find(
        (item) => item.metadataProvider === provider && item.externalId === externalId,
      ) ?? null
    );
  }

  async updateLevelRange(mediaId: string, range: readonly [CefrLevel, CefrLevel]): Promise<void> {
    const media = this.media.get(mediaId);
    if (media) this.media.set(mediaId, { ...media, levelMin: range[0], levelMax: range[1] });
  }

  async upsertMedia(input: MediaUpsert): Promise<string> {
    const existing = await this.findMediaByExternal(input.metadataProvider, input.externalId);
    const id = existing?.id ?? input.id;
    this.media.set(id, {
      id,
      type: input.type,
      title: input.title,
      originalLanguage: input.originalLanguage,
      genres: input.genres ?? existing?.genres ?? [],
      originalTitle: input.originalTitle,
      overview: input.overview,
      year: input.year,
      metadataProvider: input.metadataProvider,
      externalId: input.externalId,
      posterPath: input.posterPath,
      backdropPath: input.backdropPath,
      posterColors: input.posterColors,
      levelMin: input.levelMin,
      levelMax: input.levelMax,
      accent: input.accent,
      uploaderName: existing?.uploaderName ?? input.createdBy,
      metadataSyncedAt: input.syncedAt,
    });
    return id;
  }

  async upsertSeasons(mediaItemId: string, seasons: SeasonUpsert[]): Promise<void> {
    for (const season of seasons) {
      const existing = [...this.seasons.values()].find(
        (candidate) =>
          candidate.mediaItemId === mediaItemId && candidate.seasonNumber === season.seasonNumber,
      );
      const id = existing?.id ?? season.id;
      this.seasons.set(id, {
        id,
        mediaItemId,
        seasonNumber: season.seasonNumber,
        title: season.title,
        episodeCount: season.episodeCount ?? existing?.episodeCount ?? null,
        episodesSyncedAt: existing?.episodesSyncedAt ?? null,
      });
    }
  }

  async listSeasons(mediaItemId: string): Promise<Season[]> {
    return [...this.seasons.values()]
      .filter((season) => season.mediaItemId === mediaItemId)
      .sort((a, b) => a.seasonNumber - b.seasonNumber);
  }

  async upsertEpisodes(seasonId: string, episodes: EpisodeUpsert[], syncedAt: Date | null): Promise<void> {
    for (const episode of episodes) {
      const existing = [...this.episodes.values()].find(
        (candidate) => candidate.seasonId === seasonId && candidate.episodeNumber === episode.episodeNumber,
      );
      const id = existing?.id ?? episode.id;
      this.episodes.set(id, {
        id,
        seasonId,
        episodeNumber: episode.episodeNumber,
        title: episode.title,
        overview: episode.overview,
        durationSeconds: episode.durationSeconds,
        stillPath: episode.stillPath,
        status: existing?.status ?? "NONE",
        failureReason: existing?.failureReason ?? null,
        cueCount: existing?.cueCount ?? 0,
        alignmentPairs: existing?.alignmentPairs ?? null,
        alignmentRate: existing?.alignmentRate ?? null,
        subtitleLanguages: existing?.subtitleLanguages ?? [],
      });
    }
    const season = this.seasons.get(seasonId);
    if (season && syncedAt) this.seasons.set(seasonId, { ...season, episodesSyncedAt: syncedAt });
  }

  async listEpisodes(seasonId: string): Promise<Episode[]> {
    return [...this.episodes.values()]
      .filter((episode) => episode.seasonId === seasonId)
      .sort((a, b) => a.episodeNumber - b.episodeNumber);
  }

  async listEpisodesByMedia(mediaItemId: string): Promise<EpisodeWithSeason[]> {
    const seasons = await this.listSeasons(mediaItemId);
    const nested = await Promise.all(
      seasons.map(async (season) =>
        (await this.listEpisodes(season.id)).map((episode) => ({
          ...episode,
          seasonNumber: season.seasonNumber,
        })),
      ),
    );
    return nested.flat();
  }

  async listCatalog(): Promise<CatalogEntry[]> {
    return Promise.all(
      [...this.media.values()].map(async (media) => ({
        media,
        readyEpisodes: (await this.listEpisodesByMedia(media.id)).filter(
          (episode) => episode.status === "READY",
        ).length,
      })),
    );
  }

  async findEpisodeContext(episodeId: string): Promise<EpisodeContext | null> {
    const episode = this.episodes.get(episodeId);
    const season = episode ? this.seasons.get(episode.seasonId) : undefined;
    const media = season ? this.media.get(season.mediaItemId) : undefined;
    return episode && season && media ? { episode, season, media } : null;
  }

  async listForUser(userId: string): Promise<EpisodeProgressEntry[]> {
    return [...(this.progress.get(userId) ?? new Map<string, number>()).entries()].map(
      ([episodeId, progressPercent]) => ({ episodeId, progressPercent }),
    );
  }

  async upsert(userId: string, episodeId: string, progressPercent: number): Promise<void> {
    const byEpisode = this.progress.get(userId) ?? new Map<string, number>();
    byEpisode.set(episodeId, progressPercent);
    this.progress.set(userId, byEpisode);
  }

  setEpisodeStatus(episodeId: string, status: EpisodeStatus): void {
    const episode = this.episodes.get(episodeId);
    if (episode) this.episodes.set(episodeId, { ...episode, status });
  }
}

export class InMemoryAiLevelRatings implements AiLevelRatingRepository {
  readonly rows = new Map<string, AiLevelRating>();
  async save(rating: AiLevelRating) {
    this.rows.set(rating.externalId, rating);
  }
  async ratingsFor(externalIds: readonly string[]) {
    return new Map([...this.rows].filter(([externalId]) => externalIds.includes(externalId)));
  }
  async listIds() {
    return [...this.rows.keys()];
  }
}

export class InMemoryEpisodeLevels implements EpisodeLevelMeasurementRepository {
  readonly rows = new Map<string, EpisodeLevelMeasurementInput>();
  constructor(private readonly catalog: InMemoryCatalog) {}
  async save(input: EpisodeLevelMeasurementInput) {
    this.rows.set(input.episodeId, input);
  }
  async remove(episodeId: string) {
    this.rows.delete(episodeId);
  }
  async levelsFor(externalIds: readonly string[]) {
    const levels = new Map<string, CefrLevel[]>();
    for (const row of [...this.rows.values()].sort((a, b) => a.episodeId.localeCompare(b.episodeId))) {
      const media = this.catalog.media.get(row.mediaItemId);
      if (!media || media.metadataProvider !== "tmdb" || !externalIds.includes(media.externalId)) continue;
      levels.set(media.externalId, [...(levels.get(media.externalId) ?? []), row.measurement.level]);
    }
    return levels;
  }
}
