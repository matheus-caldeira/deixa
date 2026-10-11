import type { DailyXp } from "../domain/activity";
import type { ProfileSnapshot } from "../domain/profile";

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

export interface SnapshotRepository {
  get(userId: string): Promise<ProfileSnapshot | null>;
  upsert(userId: string, snapshot: ProfileSnapshot, now: Date): Promise<void>;
}

export interface ActivityCounts {
  reviewsSince(userId: string, since: Date): Promise<number>;
  lessonsSince(userId: string, since: Date): Promise<number>;
  lessonsEver(userId: string): Promise<number>;
  cardsOwned(userId: string): Promise<number>;
}
