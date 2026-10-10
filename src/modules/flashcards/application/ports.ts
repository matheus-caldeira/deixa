import type { CardState } from "../domain/schedule";

export type DueCardRecord = {
  cardId: string;
  learningItemId: string;
  term: string;
  meaning: string;
  meaningSource: "subtitle_pt" | "llm";
  itemType: string;
  contextText: string | null;
  contextTranslation: string | null;
  pronunciation: string | null;
  mediaTitle: string | null;
  mediaType: "series" | "movie" | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  sourceKind: string;
  state: CardState;
};

export interface CardRepository {
  addCards(
    userId: string,
    cards: { id: string; learningItemId: string; sourceKind: string }[],
    now: Date,
  ): Promise<number>;
  listDue(userId: string, now: Date, limit: number): Promise<DueCardRecord[]>;
  countDue(userId: string, now: Date): Promise<number>;
  findState(userId: string, cardId: string): Promise<CardState | null>;
  saveReview(input: {
    userId: string;
    cardId: string;
    state: CardState;
    dueAt: Date;
    log: { id: string; rating: string; responseTimeMs: number | null; reviewedAt: Date };
  }): Promise<void>;
}
