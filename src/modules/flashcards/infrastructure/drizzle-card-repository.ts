import { and, asc, eq, gt, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/infrastructure/database/client";
import {
  episodes,
  learningItemExplanations,
  learningItems,
  mediaItems,
  reviewAnticipations,
  reviewLogs,
  seasons,
  userCards,
} from "@/infrastructure/database/schema";
import { NEW_CARD_STATE, type CardState } from "../domain/schedule";
import type { CardRepository, DueCardRecord } from "../application/ports";

const LOCALE = "pt-BR";

export class DrizzleCardRepository implements CardRepository {
  constructor(private readonly db: Database) {}

  async addCards(
    userId: string,
    cards: { id: string; learningItemId: string; sourceKind: string }[],
    now: Date,
  ): Promise<number> {
    if (cards.length === 0) return 0;
    const inserted = await this.db
      .insert(userCards)
      .values(cards.map((card) => ({ ...card, userId, dueAt: now, createdAt: now, ...NEW_CARD_STATE })))
      .onConflictDoNothing({ target: [userCards.userId, userCards.learningItemId] })
      .returning({ id: userCards.id });
    return inserted.length;
  }

  async bringForward(userId: string, learningItemIds: string[], now: Date): Promise<void> {
    if (learningItemIds.length === 0) return;
    await this.db
      .update(userCards)
      .set({ dueAt: now })
      .where(
        and(
          eq(userCards.userId, userId),
          inArray(userCards.learningItemId, learningItemIds),
          gt(userCards.dueAt, now),
        ),
      );
  }

  async countUpcoming(userId: string, now: Date): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(userCards)
      .where(and(eq(userCards.userId, userId), gt(userCards.dueAt, now)));
    return row?.total ?? 0;
  }

  async pullSoonestForward(userId: string, now: Date, limit: number): Promise<number> {
    const soonest = await this.db
      .select({ id: userCards.id })
      .from(userCards)
      .where(and(eq(userCards.userId, userId), gt(userCards.dueAt, now)))
      .orderBy(asc(userCards.dueAt), asc(userCards.id))
      .limit(limit);
    if (soonest.length === 0) return 0;
    await this.db
      .update(userCards)
      .set({ dueAt: now })
      .where(
        and(
          eq(userCards.userId, userId),
          inArray(
            userCards.id,
            soonest.map((row) => row.id),
          ),
        ),
      );
    return soonest.length;
  }

  async listAnticipations(userId: string, since: Date): Promise<Date[]> {
    const rows = await this.db
      .select({ createdAt: reviewAnticipations.createdAt })
      .from(reviewAnticipations)
      .where(and(eq(reviewAnticipations.userId, userId), gte(reviewAnticipations.createdAt, since)));
    return rows.map((row) => row.createdAt);
  }

  async recordAnticipation(entry: {
    id: string;
    userId: string;
    cardsMoved: number;
    createdAt: Date;
  }): Promise<void> {
    await this.db.insert(reviewAnticipations).values(entry);
  }

  async listDue(userId: string, now: Date, limit: number): Promise<DueCardRecord[]> {
    const rows = await this.db
      .select({
        card: userCards,
        item: learningItems,
        explanation: learningItemExplanations,
        mediaTitle: mediaItems.title,
        mediaType: mediaItems.type,
        seasonNumber: seasons.seasonNumber,
        episodeNumber: episodes.episodeNumber,
      })
      .from(userCards)
      .innerJoin(learningItems, eq(learningItems.id, userCards.learningItemId))
      .leftJoin(
        learningItemExplanations,
        and(
          eq(learningItemExplanations.learningItemId, learningItems.id),
          eq(learningItemExplanations.locale, LOCALE),
        ),
      )
      .leftJoin(episodes, eq(episodes.id, learningItems.episodeId))
      .leftJoin(seasons, eq(seasons.id, episodes.seasonId))
      .leftJoin(mediaItems, eq(mediaItems.id, seasons.mediaItemId))
      .where(and(eq(userCards.userId, userId), lte(userCards.dueAt, now)))
      .orderBy(asc(userCards.dueAt), asc(userCards.createdAt), asc(userCards.id))
      .limit(limit);
    return rows.map((row) => ({
      cardId: row.card.id,
      learningItemId: row.item.id,
      term: row.item.sourceText,
      meaning: row.explanation?.translation ?? "",
      meaningSource: row.explanation?.translationSource === "subtitle_pt" ? "subtitle_pt" : "llm",
      itemType: row.item.itemType,
      contextText: row.item.contextText,
      contextTranslation: row.explanation?.contextTranslation ?? null,
      pronunciation: row.explanation?.pronunciationGuide ?? null,
      mediaTitle: row.mediaTitle,
      mediaType: row.mediaType === null ? null : row.mediaType === "movie" ? "movie" : "series",
      seasonNumber: row.seasonNumber,
      episodeNumber: row.episodeNumber,
      sourceKind: row.card.sourceKind,
      state: {
        intervalDays: row.card.intervalDays,
        repetitions: row.card.repetitions,
        lapses: row.card.lapses,
        stability: row.card.stability,
        difficulty: row.card.difficulty,
      },
    }));
  }

  async countDue(userId: string, now: Date): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(userCards)
      .where(and(eq(userCards.userId, userId), lte(userCards.dueAt, now)));
    return row?.total ?? 0;
  }

  async findState(userId: string, cardId: string): Promise<CardState | null> {
    if (!z.uuid().safeParse(cardId).success) return null;
    const [row] = await this.db
      .select()
      .from(userCards)
      .where(and(eq(userCards.userId, userId), eq(userCards.id, cardId)))
      .limit(1);
    if (!row) return null;
    return {
      intervalDays: row.intervalDays,
      repetitions: row.repetitions,
      lapses: row.lapses,
      stability: row.stability,
      difficulty: row.difficulty,
    };
  }

  async saveReview(input: {
    userId: string;
    cardId: string;
    state: CardState;
    dueAt: Date;
    log: { id: string; rating: string; responseTimeMs: number | null; reviewedAt: Date };
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      const updated = await tx
        .update(userCards)
        .set({ ...input.state, dueAt: input.dueAt })
        .where(and(eq(userCards.userId, input.userId), eq(userCards.id, input.cardId)))
        .returning({ id: userCards.id });
      if (updated.length === 0) return;
      await tx.insert(reviewLogs).values({ ...input.log, userCardId: input.cardId });
    });
  }
}
