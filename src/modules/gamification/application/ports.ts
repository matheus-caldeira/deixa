import type { DailyXp } from "../domain/activity";
import type { KindStats } from "../domain/profile";

export interface XpRepository {
  award(event: {
    id: string;
    userId: string;
    source: string;
    sourceId: string;
    amount: number;
    createdAt: Date;
  }): Promise<boolean>;
  dailyTotals(userId: string, timeZone: string): Promise<DailyXp[]>;
}

export type LessonStats = { correct: number; total: number; passed: number; byKind: KindStats };

export interface ActivityCounts {
  reviewsSince(userId: string, since: Date): Promise<number>;
  lessonsSince(userId: string, since: Date): Promise<number>;
  lessonsEver(userId: string): Promise<number>;
  cardsOwned(userId: string): Promise<number>;
  lessonStats(userId: string, since: Date | null): Promise<LessonStats>;
  reviewOutcomesSince(userId: string, since: Date): Promise<{ total: number; again: number }>;
  recurringMisses(userId: string, since: Date, limit: number): Promise<{ term: string; count: number }[]>;
  episodesCompleted(userId: string): Promise<number>;
  conversationScores(userId: string): Promise<number[]>;
  phrasalCards(userId: string): Promise<number>;
}
