import type { LanguagePair } from "@/shared/study-languages";
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
  bringForward(userId: string, learningItemIds: string[], now: Date): Promise<void>;
  listDue(userId: string, now: Date, limit: number, pair: LanguagePair): Promise<DueCardRecord[]>;
  countUpcoming(userId: string, now: Date, pair: LanguagePair): Promise<number>;
  pullSoonestForward(userId: string, now: Date, limit: number, pair: LanguagePair): Promise<number>;
  listAnticipations(userId: string, since: Date): Promise<Date[]>;
  recordAnticipation(entry: {
    id: string;
    userId: string;
    cardsMoved: number;
    createdAt: Date;
  }): Promise<void>;
  countDue(userId: string, now: Date, pair: LanguagePair): Promise<number>;
  findState(userId: string, cardId: string): Promise<CardState | null>;
  saveReview(input: {
    userId: string;
    cardId: string;
    state: CardState;
    dueAt: Date;
    log: { id: string; rating: string; responseTimeMs: number | null; reviewedAt: Date };
  }): Promise<void>;
}
