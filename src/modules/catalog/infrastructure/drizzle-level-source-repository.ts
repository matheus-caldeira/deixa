import { and, asc, eq, inArray, isNotNull, notInArray } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { levelRatings, levelSources } from "@/infrastructure/database/schema";
import { isCefrLevel } from "@/shared/levels";
import {
  LEVEL_FETCH_FAILURES,
  type LevelFetchFailure,
  type LevelRating,
  type LevelSource,
  type LevelSourceRepository,
} from "../application/level-sources";
import {
  LEVEL_SOURCE_STATUSES,
  MAX_LEVEL_SOURCE_NAME_LENGTH,
  type LevelRange,
  type LevelSourceStatus,
} from "../domain/level-ratings";

const RATINGS_PER_INSERT = 1000;

const asStatus = (value: string): LevelSourceStatus =>
  LEVEL_SOURCE_STATUSES.find((status) => status === value) ?? "PENDING";
const asFailure = (value: string | null): LevelFetchFailure | null =>
  LEVEL_FETCH_FAILURES.find((failure) => failure === value) ?? null;

function toSource(row: typeof levelSources.$inferSelect): LevelSource {
  return {
    id: row.id,
    url: row.url,
    name: row.name,
    parentId: row.parentId,
    enabled: row.enabled,
    status: asStatus(row.status),
    ratingCount: row.ratingCount,
    rejectedCount: row.rejectedCount,
    lastError: asFailure(row.lastError),
    lastStatus: row.lastStatus,
    fetchedAt: row.fetchedAt,
    createdAt: row.createdAt,
  };
}

export class DrizzleLevelSourceRepository implements LevelSourceRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<LevelSource[]> {
    const rows = await this.db
      .select()
      .from(levelSources)
      .orderBy(asc(levelSources.createdAt), asc(levelSources.url));
    return rows.map(toSource);
  }

  async find(id: string): Promise<LevelSource | null> {
    const [row] = await this.db.select().from(levelSources).where(eq(levelSources.id, id)).limit(1);
    return row ? toSource(row) : null;
  }

  async findByUrl(url: string): Promise<LevelSource | null> {
    const [row] = await this.db.select().from(levelSources).where(eq(levelSources.url, url)).limit(1);
    return row ? toSource(row) : null;
  }

  async add(input: {
    id: string;
    url: string;
    parentId: string | null;
    createdBy: string | null;
    now: Date;
  }): Promise<void> {
    await this.db
      .insert(levelSources)
      .values({
        id: input.id,
        url: input.url,
        parentId: input.parentId,
        createdBy: input.createdBy,
        createdAt: input.now,
        updatedAt: input.now,
      })
      .onConflictDoNothing();
  }

  async remove(id: string): Promise<void> {
    await this.db.delete(levelSources).where(eq(levelSources.id, id));
  }

  async removeChildrenExcept(parentId: string, urls: readonly string[]): Promise<void> {
    await this.db
      .delete(levelSources)
      .where(
        urls.length > 0
          ? and(eq(levelSources.parentId, parentId), notInArray(levelSources.url, [...urls]))
          : eq(levelSources.parentId, parentId),
      );
  }

  async setEnabled(id: string, enabled: boolean, now: Date): Promise<void> {
    await this.db.update(levelSources).set({ enabled, updatedAt: now }).where(eq(levelSources.id, id));
  }

  async saveRatings(
    id: string,
    result: { name: string | null; ratings: ReadonlyMap<string, LevelRange>; rejected: number; now: Date },
  ): Promise<void> {
    const rows = [...result.ratings].map(([externalId, [levelMin, levelMax]]) => ({
      sourceId: id,
      externalId,
      levelMin,
      levelMax,
    }));
    await this.db.transaction(async (tx) => {
      await tx.delete(levelRatings).where(eq(levelRatings.sourceId, id));
      for (let start = 0; start < rows.length; start += RATINGS_PER_INSERT) {
        await tx.insert(levelRatings).values(rows.slice(start, start + RATINGS_PER_INSERT));
      }
      await tx
        .update(levelSources)
        .set({
          name: result.name?.slice(0, MAX_LEVEL_SOURCE_NAME_LENGTH) ?? null,
          status: "READY",
          ratingCount: rows.length,
          rejectedCount: result.rejected,
          lastError: null,
          lastStatus: null,
          fetchedAt: result.now,
          updatedAt: result.now,
        })
        .where(eq(levelSources.id, id));
    });
  }

  async saveFailure(
    id: string,
    failure: { reason: LevelFetchFailure; status: number | null; now: Date },
  ): Promise<void> {
    await this.db
      .update(levelSources)
      .set({
        status: "FAILED",
        lastError: failure.reason,
        lastStatus: failure.status,
        fetchedAt: failure.now,
        updatedAt: failure.now,
      })
      .where(eq(levelSources.id, id));
  }

  async ratedIds(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ externalId: levelRatings.externalId })
      .from(levelRatings)
      .innerJoin(levelSources, eq(levelSources.id, levelRatings.sourceId))
      .where(and(eq(levelSources.enabled, true), eq(levelSources.status, "READY")));
    return rows.map((row) => row.externalId);
  }

  async ratingsFor(externalIds: readonly string[]): Promise<Map<string, LevelRating[]>> {
    const ratings = new Map<string, LevelRating[]>();
    if (externalIds.length === 0) return ratings;
    const rows = await this.db
      .select({
        externalId: levelRatings.externalId,
        levelMin: levelRatings.levelMin,
        levelMax: levelRatings.levelMax,
        sourceId: levelSources.id,
        sourceName: levelSources.name,
        url: levelSources.url,
      })
      .from(levelRatings)
      .innerJoin(levelSources, eq(levelSources.id, levelRatings.sourceId))
      .where(
        and(
          inArray(levelRatings.externalId, [...externalIds]),
          eq(levelSources.enabled, true),
          eq(levelSources.status, "READY"),
          isNotNull(levelSources.fetchedAt),
        ),
      )
      .orderBy(asc(levelSources.createdAt));
    for (const row of rows) {
      if (!isCefrLevel(row.levelMin) || !isCefrLevel(row.levelMax)) continue;
      const list = ratings.get(row.externalId) ?? [];
      list.push({
        kind: "source",
        sourceId: row.sourceId,
        sourceName: row.sourceName ?? new URL(row.url).hostname,
        range: [row.levelMin, row.levelMax],
      });
      ratings.set(row.externalId, list);
    }
    return ratings;
  }
}
