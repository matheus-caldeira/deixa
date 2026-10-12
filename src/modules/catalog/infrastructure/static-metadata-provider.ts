import { z } from "zod";
import { AppError } from "@/shared/errors";
import type { MediaType } from "../domain/catalog";
import type {
  EpisodeMetadata,
  MetadataProvider,
  WorkCandidate,
  WorkDetails,
  WorkSummary,
} from "../application/ports";

const path = z.string().nullable();

export const staticCatalogSchema = z.object({
  source: z.literal("tmdb"),
  works: z.array(
    z.object({
      slug: z.string(),
      externalId: z.string().regex(/^(tv|movie):\d+$/),
      type: z.enum(["series", "movie"]),
      title: z.string().min(1),
      originalTitle: z.string().min(1),
      overview: z.string(),
      genres: z.array(z.string()),
      year: z.number().nullable(),
      posterPath: path,
      backdropPath: path,
      runtimeMinutes: z.number().nullable(),
      seasons: z.array(
        z.object({
          seasonNumber: z.number().int(),
          title: z.string(),
          episodeCount: z.number().nullable(),
          episodes: z.array(
            z.object({
              episodeNumber: z.number().int(),
              title: z.string(),
              runtimeMinutes: z.number().nullable(),
              stillPath: path,
            }),
          ),
        }),
      ),
    }),
  ),
});

export type StaticCatalog = z.infer<typeof staticCatalogSchema>;
type StaticWork = StaticCatalog["works"][number];

function toSummary(work: StaticWork): WorkSummary {
  return {
    provider: "tmdb",
    externalId: work.externalId,
    type: work.type,
    title: work.title,
    originalTitle: work.originalTitle,
    overview: work.overview,
    year: work.year,
    posterPath: work.posterPath,
    backdropPath: work.backdropPath,
  };
}

export class StaticMetadataProvider implements MetadataProvider {
  readonly name = "tmdb" as const;
  private readonly works: StaticWork[];

  constructor(catalog: unknown) {
    this.works = staticCatalogSchema.parse(catalog).works;
  }

  private find(type: MediaType, externalId: string): StaticWork {
    const work = this.works.find((candidate) => candidate.externalId === externalId);
    if (!work || work.type !== type) throw new AppError("METADATA_NOT_FOUND");
    return work;
  }

  private toCandidate(work: StaticWork, position: number): WorkCandidate {
    return {
      ...toSummary(work),
      genres: work.genres,
      originalLanguage: "en",
      popularity: this.works.length - position,
    };
  }

  async searchWorks(query: string): Promise<WorkSummary[]> {
    const needle = query.trim().toLowerCase();
    return this.works
      .filter((work) => `${work.title} ${work.originalTitle}`.toLowerCase().includes(needle))
      .map(toSummary);
  }

  async getWork(type: MediaType, externalId: string): Promise<WorkDetails> {
    const work = this.find(type, externalId);
    return {
      ...toSummary(work),
      runtimeMinutes: work.runtimeMinutes,
      seasons: work.seasons.map(({ seasonNumber, title, episodeCount }) => ({
        seasonNumber,
        title,
        episodeCount,
      })),
    };
  }

  async getSeasonEpisodes(externalId: string, seasonNumber: number): Promise<EpisodeMetadata[]> {
    const season = this.find("series", externalId).seasons.find(
      (candidate) => candidate.seasonNumber === seasonNumber,
    );
    if (!season || season.episodes.length === 0) throw new AppError("METADATA_NOT_FOUND");
    return season.episodes.map((episode) => ({ ...episode, overview: "" }));
  }

  async listRelatedWorks(type: MediaType, externalId: string): Promise<WorkCandidate[]> {
    const origin = this.works.find((work) => work.externalId === externalId && work.type === type);
    if (!origin) return [];
    return this.works.flatMap((work, position) =>
      work !== origin && work.genres.some((genre) => origin.genres.includes(genre))
        ? [this.toCandidate(work, position)]
        : [],
    );
  }

  async listPopularWorks(): Promise<WorkCandidate[]> {
    return this.works.map((work, position) => this.toCandidate(work, position));
  }
}
