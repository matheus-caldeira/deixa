import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/infrastructure/database/client";
import { conversationSessions, conversationTurns } from "@/infrastructure/database/schema";
import type { CefrLevel } from "@/shared/levels";
import type { ConversationReview, Correction, Session, Turn, TurnRole } from "../domain/conversation";
import type { ConversationRepository } from "../application/conversation-use-cases";

const correctionsSchema = z.array(z.object({ wrong: z.string(), right: z.string(), why: z.string() }));
const reviewSchema = z.object({
  summary: z.string(),
  score: z.number(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  phrases: correctionsSchema,
});

type SessionRow = typeof conversationSessions.$inferSelect;

function toSession(row: SessionRow): Session {
  const review = row.review ? reviewSchema.safeParse(row.review) : null;
  return {
    id: row.id,
    themeId: row.themeId,
    themeTitle: row.themeTitle,
    level: row.level,
    review: review?.success ? review.data : null,
    createdAt: row.createdAt,
  };
}

const isId = (value: string): boolean => z.uuid().safeParse(value).success;

export class DrizzleConversationRepository implements ConversationRepository {
  constructor(private readonly db: Database) {}

  async createSession(input: {
    id: string;
    userId: string;
    themeId: string;
    themeTitle: string;
    level: CefrLevel;
    now: Date;
  }): Promise<void> {
    await this.db.insert(conversationSessions).values({
      id: input.id,
      userId: input.userId,
      themeId: input.themeId,
      themeTitle: input.themeTitle,
      level: input.level,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  async findSession(userId: string, sessionId: string): Promise<Session | null> {
    if (!isId(sessionId)) return null;
    const [row] = await this.db
      .select()
      .from(conversationSessions)
      .where(and(eq(conversationSessions.id, sessionId), eq(conversationSessions.userId, userId)))
      .limit(1);
    return row ? toSession(row) : null;
  }

  async listSessions(userId: string, limit: number): Promise<(Session & { turnCount: number })[]> {
    const turnCount = sql<number>`(select count(*)::int from ${conversationTurns} where ${conversationTurns.sessionId} = ${conversationSessions.id})`;
    const rows = await this.db
      .select({ session: conversationSessions, turnCount })
      .from(conversationSessions)
      .where(eq(conversationSessions.userId, userId))
      .orderBy(desc(conversationSessions.updatedAt))
      .limit(limit);
    return rows.map((row) => ({ ...toSession(row.session), turnCount: row.turnCount }));
  }

  async addTurn(input: {
    id: string;
    sessionId: string;
    role: TurnRole;
    text: string;
    translation: string | null;
    corrections: Correction[];
    inputKind: "text" | "audio";
    now: Date;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(conversationTurns).values({
        id: input.id,
        sessionId: input.sessionId,
        role: input.role,
        text: input.text,
        translation: input.translation,
        corrections: input.corrections,
        inputKind: input.inputKind,
        createdAt: input.now,
      });
      await tx
        .update(conversationSessions)
        .set({ updatedAt: input.now })
        .where(eq(conversationSessions.id, input.sessionId));
    });
  }

  async listTurns(sessionId: string): Promise<Turn[]> {
    const rows = await this.db
      .select()
      .from(conversationTurns)
      .where(eq(conversationTurns.sessionId, sessionId))
      .orderBy(asc(conversationTurns.createdAt));
    return rows.map((row) => {
      const corrections = correctionsSchema.safeParse(row.corrections);
      return {
        id: row.id,
        role: row.role === "user" ? "user" : "tutor",
        text: row.text,
        translation: row.translation,
        corrections: corrections.success ? corrections.data : [],
        createdAt: row.createdAt,
      };
    });
  }

  async saveReview(userId: string, sessionId: string, review: ConversationReview, now: Date): Promise<void> {
    await this.db
      .update(conversationSessions)
      .set({ review, updatedAt: now })
      .where(and(eq(conversationSessions.id, sessionId), eq(conversationSessions.userId, userId)));
  }

  async findTurnText(userId: string, turnId: string): Promise<string | null> {
    if (!isId(turnId)) return null;
    const [row] = await this.db
      .select({ text: conversationTurns.text })
      .from(conversationTurns)
      .innerJoin(conversationSessions, eq(conversationSessions.id, conversationTurns.sessionId))
      .where(and(eq(conversationTurns.id, turnId), eq(conversationSessions.userId, userId)))
      .limit(1);
    return row?.text ?? null;
  }
}
