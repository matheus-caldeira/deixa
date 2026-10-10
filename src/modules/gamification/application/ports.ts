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
  sumSince(userId: string, since: Date): Promise<number>;
  total(userId: string): Promise<number>;
}

export interface SnapshotRepository {
  get(userId: string): Promise<ProfileSnapshot | null>;
  upsert(userId: string, snapshot: ProfileSnapshot, now: Date): Promise<void>;
}
