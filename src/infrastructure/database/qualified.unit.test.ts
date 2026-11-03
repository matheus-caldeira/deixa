import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it } from "vitest";
import { qualified } from "./qualified";
import { conversationSessions, conversationTurns } from "./schema";

describe("coluna qualificada em subconsulta", () => {
  it("leva o nome da tabela mesmo quando a consulta externa não tem join", () => {
    const turnCount = sql<number>`(select count(*)::int from ${conversationTurns} where ${qualified(conversationTurns.sessionId)} = ${qualified(conversationSessions.id)})`;
    const query = drizzle.mock().select({ turnCount }).from(conversationSessions).toSQL().sql;
    expect(query).toContain(`"conversation_turns"."session_id" = "conversation_sessions"."id"`);
  });
});
