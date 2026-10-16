import { and, asc, eq, isNotNull } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { episodeRecaps, learningItems, userCards } from "@/infrastructure/database/schema";
import type { RecapRepository } from "../application/recap-use-cases";
import { RECAP_SOURCES, type Recap, type RecapSource } from "../domain/recap";

const asSource = (value: string): RecapSource =>
  RECAP_SOURCES.find((source) => source === value) ?? "catalog";

function toRecap(row: typeof episodeRecaps.$inferSelect): Recap {
  return {
    id: row.id,
    userId: row.userId,
    source: asSource(row.source),
    episodeId: row.episodeId,
    step: row.step,
    dueAt: row.dueAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleRecapRepository implements RecapRepository {
  constructor(private readonly db: Database) {}

  async list(userId: string, pair: string): Promise<Recap[]> {
    const rows = await this.db
      .select()
      .from(episodeRecaps)
      .where(and(eq(episodeRecaps.userId, userId), eq(episodeRecaps.languagePair, pair)))
      .orderBy(asc(episodeRecaps.createdAt));
    return rows.map(toRecap);
  }

  async find(userId: string, pair: string, recapId: string): Promise<Recap | null> {
    const [row] = await this.db
      .select()
      .from(episodeRecaps)
      .where(
        and(
          eq(episodeRecaps.id, recapId),
          eq(episodeRecaps.userId, userId),
          eq(episodeRecaps.languagePair, pair),
        ),
      )
      .limit(1);
    return row ? toRecap(row) : null;
  }

  async ensure(
    rows: { id: string; userId: string; source: RecapSource; episodeId: string; pair: string; dueAt: Date }[],
    now: Date,
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.db
      .insert(episodeRecaps)
      .values(
        rows.map((row) => ({
          id: row.id,
          userId: row.userId,
          source: row.source,
          episodeId: row.episodeId,
          languagePair: row.pair,
          step: 0,
          dueAt: row.dueAt,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoNothing();
  }

  async cardCueIds(userId: string, episodeId: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ cueId: learningItems.cueId })
      .from(userCards)
      .innerJoin(learningItems, eq(learningItems.id, userCards.learningItemId))
      .where(
        and(
          eq(userCards.userId, userId),
          eq(learningItems.episodeId, episodeId),
          isNotNull(learningItems.cueId),
        ),
      );
    return new Set(rows.flatMap((row) => (row.cueId ? [row.cueId] : [])));
  }

  async saveStep(
    userId: string,
    recapId: string,
    step: number,
    dueAt: Date | null,
    now: Date,
  ): Promise<void> {
    await this.db
      .update(episodeRecaps)
      .set({ step, dueAt, updatedAt: now })
      .where(and(eq(episodeRecaps.id, recapId), eq(episodeRecaps.userId, userId)));
  }
}
