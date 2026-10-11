import { and, asc, eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { lessonAttempts } from "@/infrastructure/database/schema";
import type { LessonAttempt, StudyRepository } from "../application/study-use-cases";

export class DrizzleStudyRepository implements StudyRepository {
  constructor(private readonly db: Database) {}

  async listAttempts(userId: string, episodeId: string): Promise<{ nodeIndex: number; createdAt: Date }[]> {
    return this.db
      .select({ nodeIndex: lessonAttempts.nodeIndex, createdAt: lessonAttempts.createdAt })
      .from(lessonAttempts)
      .where(and(eq(lessonAttempts.userId, userId), eq(lessonAttempts.episodeId, episodeId)))
      .orderBy(asc(lessonAttempts.createdAt));
  }

  async saveAttempt(attempt: LessonAttempt): Promise<void> {
    await this.db.insert(lessonAttempts).values(attempt);
  }
}
