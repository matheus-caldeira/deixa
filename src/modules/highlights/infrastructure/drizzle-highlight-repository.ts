import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { highlightStats, subtitleCues, userHighlights } from "@/infrastructure/database/schema";
import type {
  Highlight,
  HighlightKind,
  HighlightSpan,
  HighlightStat,
  ShareScope,
} from "../domain/highlights";
import type { HighlightRepository } from "../application/ports";

const toKind = (value: string): HighlightKind =>
  value === "phrase" ? "phrase" : value === "line" ? "line" : "word";
const toScope = (value: string): ShareScope => (value === "catalog" ? "catalog" : "private");

export class DrizzleHighlightRepository implements HighlightRepository {
  constructor(private readonly db: Database) {}

  async listForEpisode(userId: string, episodeId: string): Promise<Highlight[]> {
    const rows = await this.db
      .select({ highlight: userHighlights, sequence: subtitleCues.sequence })
      .from(userHighlights)
      .innerJoin(subtitleCues, eq(subtitleCues.id, userHighlights.cueId))
      .where(and(eq(userHighlights.userId, userId), eq(userHighlights.episodeId, episodeId)))
      .orderBy(asc(subtitleCues.sequence), asc(userHighlights.startToken), asc(userHighlights.kind));
    return rows.map(({ highlight }) => ({
      id: highlight.id,
      cueId: highlight.cueId,
      startToken: highlight.startToken,
      endToken: highlight.endToken,
      kind: toKind(highlight.kind),
      shareScope: toScope(highlight.shareScope),
      cardBatchId: highlight.cardBatchId,
    }));
  }

  async insert(
    userId: string,
    episodeId: string,
    spans: (HighlightSpan & { id: string })[],
    now: Date,
  ): Promise<void> {
    if (spans.length === 0) return;
    await this.db
      .insert(userHighlights)
      .values(spans.map((span) => ({ ...span, userId, episodeId, shareScope: "private", createdAt: now })))
      .onConflictDoNothing();
  }

  async deleteByIds(userId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .delete(userHighlights)
      .where(and(eq(userHighlights.userId, userId), inArray(userHighlights.id, ids)));
  }

  async markCarded(input: {
    userId: string;
    episodeId: string;
    highlightIds: string[];
    batchId: string;
    scope: ShareScope;
  }): Promise<HighlightSpan[]> {
    if (input.highlightIds.length === 0) return [];
    return this.db.transaction(async (tx) => {
      const owned = and(
        eq(userHighlights.userId, input.userId),
        eq(userHighlights.episodeId, input.episodeId),
        inArray(userHighlights.id, input.highlightIds),
      );
      const before = await tx.select().from(userHighlights).where(owned);
      const newlyShared =
        input.scope === "catalog" ? before.filter((highlight) => highlight.shareScope !== "catalog") : [];
      await tx
        .update(userHighlights)
        .set({ cardBatchId: input.batchId, ...(input.scope === "catalog" ? { shareScope: "catalog" } : {}) })
        .where(owned);
      return newlyShared.map((highlight) => ({
        cueId: highlight.cueId,
        startToken: highlight.startToken,
        endToken: highlight.endToken,
        kind: toKind(highlight.kind),
      }));
    });
  }

  async recountStats(episodeId: string, spans: HighlightSpan[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const span of spans) {
        const sameSpan = and(
          eq(userHighlights.cueId, span.cueId),
          eq(userHighlights.startToken, span.startToken),
          eq(userHighlights.endToken, span.endToken),
        );
        const [counted] = await tx
          .select({ users: sql<number>`count(distinct ${userHighlights.userId})::int` })
          .from(userHighlights)
          .where(and(sameSpan, eq(userHighlights.shareScope, "catalog")));
        const userCount = counted?.users ?? 0;
        const statKey = and(
          eq(highlightStats.cueId, span.cueId),
          eq(highlightStats.startToken, span.startToken),
          eq(highlightStats.endToken, span.endToken),
        );
        if (userCount === 0) {
          await tx.delete(highlightStats).where(statKey);
          continue;
        }
        await tx
          .insert(highlightStats)
          .values({
            episodeId,
            cueId: span.cueId,
            startToken: span.startToken,
            endToken: span.endToken,
            userCount,
          })
          .onConflictDoUpdate({
            target: [highlightStats.cueId, highlightStats.startToken, highlightStats.endToken],
            set: { userCount },
          });
      }
    });
  }

  async listStats(episodeId: string): Promise<HighlightStat[]> {
    return this.db
      .select({
        cueId: highlightStats.cueId,
        startToken: highlightStats.startToken,
        endToken: highlightStats.endToken,
        userCount: highlightStats.userCount,
      })
      .from(highlightStats)
      .where(eq(highlightStats.episodeId, episodeId));
  }
}
