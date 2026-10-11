import { and, asc, eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { lessonAttempts, lessonPlans } from "@/infrastructure/database/schema";
import type { CefrLevel } from "@/shared/levels";
import { lessonPlanSchema } from "../domain/plan";
import type {
  LessonAttempt,
  PlanRepository,
  StoredPlan,
  StudyRepository,
} from "../application/study-use-cases";
import type { LessonPlan } from "../domain/plan";

const STATUSES = ["PENDING", "READY", "FAILED"] as const;

export class DrizzleStudyRepository implements StudyRepository, PlanRepository {
  constructor(private readonly db: Database) {}

  async listAttempts(
    userId: string,
    episodeId: string,
    level: CefrLevel,
  ): Promise<{ nodeIndex: number; passed: boolean; createdAt: Date }[]> {
    return this.db
      .select({
        nodeIndex: lessonAttempts.nodeIndex,
        passed: lessonAttempts.passed,
        createdAt: lessonAttempts.createdAt,
      })
      .from(lessonAttempts)
      .where(
        and(
          eq(lessonAttempts.userId, userId),
          eq(lessonAttempts.episodeId, episodeId),
          eq(lessonAttempts.level, level),
        ),
      )
      .orderBy(asc(lessonAttempts.createdAt));
  }

  async saveAttempt(attempt: LessonAttempt): Promise<void> {
    await this.db.insert(lessonAttempts).values(attempt);
  }

  async find(episodeId: string, level: CefrLevel): Promise<StoredPlan | null> {
    const [row] = await this.db
      .select()
      .from(lessonPlans)
      .where(and(eq(lessonPlans.episodeId, episodeId), eq(lessonPlans.level, level)))
      .limit(1);
    if (!row) return null;
    const parsed = row.plan ? lessonPlanSchema.safeParse(row.plan) : null;
    const status = STATUSES.find((candidate) => candidate === row.status) ?? "FAILED";
    return {
      status: status === "READY" && !parsed?.success ? "FAILED" : status,
      plan: parsed?.success ? parsed.data : null,
      failureReason: row.failureReason,
      updatedAt: row.updatedAt,
    };
  }

  private async upsert(
    input: { id: string; episodeId: string; level: CefrLevel; now: Date },
    values: {
      status: string;
      provider: string | null;
      plan: LessonPlan | null;
      failureReason: string | null;
    },
    requestedBy: string | null,
  ): Promise<void> {
    await this.db
      .insert(lessonPlans)
      .values({
        id: input.id,
        episodeId: input.episodeId,
        level: input.level,
        requestedBy,
        createdAt: input.now,
        updatedAt: input.now,
        ...values,
      })
      .onConflictDoUpdate({
        target: [lessonPlans.episodeId, lessonPlans.level],
        set: { ...values, updatedAt: input.now },
      });
  }

  async markPending(input: {
    id: string;
    episodeId: string;
    level: CefrLevel;
    requestedBy: string;
    now: Date;
  }): Promise<void> {
    await this.upsert(
      input,
      { status: "PENDING", provider: null, plan: null, failureReason: null },
      input.requestedBy,
    );
  }

  async saveReady(input: {
    id: string;
    episodeId: string;
    level: CefrLevel;
    plan: LessonPlan;
    now: Date;
  }): Promise<void> {
    await this.upsert(
      input,
      { status: "READY", provider: input.plan.provider, plan: input.plan, failureReason: null },
      null,
    );
  }

  async markFailed(input: { episodeId: string; level: CefrLevel; reason: string; now: Date }): Promise<void> {
    await this.db
      .update(lessonPlans)
      .set({ status: "FAILED", failureReason: input.reason.slice(0, 300), updatedAt: input.now })
      .where(and(eq(lessonPlans.episodeId, input.episodeId), eq(lessonPlans.level, input.level)));
  }
}
