import { NEW_CARD_STATE, type CardState } from "../../domain/schedule";
import type { CardRepository, DueCardRecord } from "../ports";

type Row = {
  id: string;
  userId: string;
  learningItemId: string;
  sourceKind: string;
  dueAt: Date;
  state: CardState;
};

export class InMemoryCards implements CardRepository {
  readonly rows: Row[] = [];
  readonly logs: { cardId: string; rating: string; reviewedAt: Date }[] = [];

  async addCards(
    userId: string,
    cards: { id: string; learningItemId: string; sourceKind: string }[],
    now: Date,
  ): Promise<number> {
    let created = 0;
    for (const card of cards) {
      const exists = this.rows.some(
        (row) => row.userId === userId && row.learningItemId === card.learningItemId,
      );
      if (exists) continue;
      this.rows.push({ ...card, userId, dueAt: now, state: { ...NEW_CARD_STATE } });
      created += 1;
    }
    return created;
  }

  async bringForward(userId: string, learningItemIds: string[], now: Date): Promise<void> {
    for (const row of this.rows) {
      if (row.userId === userId && learningItemIds.includes(row.learningItemId) && row.dueAt > now)
        row.dueAt = now;
    }
  }

  readonly anticipations: { userId: string; createdAt: Date }[] = [];

  async countUpcoming(userId: string, now: Date): Promise<number> {
    return this.rows.filter((row) => row.userId === userId && row.dueAt > now).length;
  }

  async pullSoonestForward(userId: string, now: Date, limit: number): Promise<number> {
    const soonest = this.rows
      .filter((row) => row.userId === userId && row.dueAt > now)
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
      .slice(0, limit);
    for (const row of soonest) row.dueAt = now;
    return soonest.length;
  }

  async listAnticipations(userId: string, since: Date): Promise<Date[]> {
    return this.anticipations
      .filter((entry) => entry.userId === userId && entry.createdAt >= since)
      .map((entry) => entry.createdAt);
  }

  async recordAnticipation(entry: { userId: string; createdAt: Date }): Promise<void> {
    this.anticipations.push({ userId: entry.userId, createdAt: entry.createdAt });
  }

  private due(userId: string, now: Date): Row[] {
    return this.rows
      .filter((row) => row.userId === userId && row.dueAt <= now)
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  }

  async listDue(userId: string, now: Date, limit: number): Promise<DueCardRecord[]> {
    return this.due(userId, now)
      .slice(0, limit)
      .map((row) => ({
        cardId: row.id,
        learningItemId: row.learningItemId,
        term: `termo de ${row.learningItemId}`,
        meaning: "significado",
        meaningSource: "llm",
        itemType: "expression",
        contextText: null,
        contextTranslation: null,
        pronunciation: null,
        mediaTitle: "How I Met Your Mother",
        mediaType: "series",
        seasonNumber: 1,
        episodeNumber: 3,
        sourceKind: row.sourceKind,
        state: row.state,
      }));
  }

  async countDue(userId: string, now: Date): Promise<number> {
    return this.due(userId, now).length;
  }

  async findState(userId: string, cardId: string): Promise<CardState | null> {
    return this.rows.find((row) => row.userId === userId && row.id === cardId)?.state ?? null;
  }

  async saveReview(input: {
    userId: string;
    cardId: string;
    state: CardState;
    dueAt: Date;
    log: { rating: string; reviewedAt: Date };
  }): Promise<void> {
    const row = this.rows.find(
      (candidate) => candidate.userId === input.userId && candidate.id === input.cardId,
    );
    if (!row) return;
    row.state = input.state;
    row.dueAt = input.dueAt;
    this.logs.push({ cardId: input.cardId, rating: input.log.rating, reviewedAt: input.log.reviewedAt });
  }
}
