import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { episodeLevelMeasurements, mediaItems } from "@/infrastructure/database/schema";
import { isCefrLevel, type CefrLevel } from "@/shared/levels";
import type { EpisodeLevelMeasurementInput, EpisodeLevelMeasurementRepository } from "../application/ports";

const TMDB = "tmdb";

export class DrizzleEpisodeLevelRepository implements EpisodeLevelMeasurementRepository {
  constructor(private readonly db: Database) {}

  async save(input: EpisodeLevelMeasurementInput): Promise<void> {
    const { measurement } = input;
    const values = {
      mediaItemId: input.mediaItemId,
      language: input.language,
      level: measurement.level,
      score: measurement.score,
      words: measurement.words,
      wordsPerMinute: measurement.wordsPerMinute,
      meanSentenceWords: measurement.meanSentenceWords,
      lexicalDiversity: measurement.lexicalDiversity,
      longWordRatio: measurement.longWordRatio,
      measuredAt: input.now,
    };
    await this.db
      .insert(episodeLevelMeasurements)
      .values({ episodeId: input.episodeId, ...values })
      .onConflictDoUpdate({ target: episodeLevelMeasurements.episodeId, set: values });
  }

  async remove(episodeId: string): Promise<void> {
    await this.db.delete(episodeLevelMeasurements).where(eq(episodeLevelMeasurements.episodeId, episodeId));
  }

  async levelsFor(externalIds: readonly string[]): Promise<Map<string, CefrLevel[]>> {
    const levels = new Map<string, CefrLevel[]>();
    if (externalIds.length === 0) return levels;
    const rows = await this.db
      .select({ externalId: mediaItems.externalId, level: episodeLevelMeasurements.level })
      .from(episodeLevelMeasurements)
      .innerJoin(mediaItems, eq(mediaItems.id, episodeLevelMeasurements.mediaItemId))
      .where(and(eq(mediaItems.metadataProvider, TMDB), inArray(mediaItems.externalId, [...externalIds])))
      .orderBy(asc(episodeLevelMeasurements.episodeId));
    for (const row of rows) {
      if (!isCefrLevel(row.level)) continue;
      levels.set(row.externalId, [...(levels.get(row.externalId) ?? []), row.level]);
    }
    return levels;
  }
}
