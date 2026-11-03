import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/infrastructure/database/client";
import { users } from "@/infrastructure/database/schema";
import { openTestDatabase, testDatabaseAvailable } from "@/infrastructure/database/test-database";
import { DrizzleConversationRepository } from "./drizzle-conversation-repository";

const TEST_DATABASE = "deixa_test_conversations";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const BUSY = "22222222-2222-4222-8222-222222222222";
const EMPTY = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-11-03T12:00:00Z");
const TURNS = 3;

describe.skipIf(!testDatabaseAvailable)("conversas no Postgres real", () => {
  let handle: DatabaseHandle;
  let conversations: DrizzleConversationRepository;

  beforeAll(async () => {
    handle = await openTestDatabase(TEST_DATABASE);
    conversations = new DrizzleConversationRepository(handle.db);
    await handle.db.insert(users).values({
      id: USER_ID,
      name: "Ana",
      email: "ana@teste.example",
      passwordHash: "x",
      avatarColor: "#000000",
      createdAt: NOW,
    });
    for (const id of [BUSY, EMPTY]) {
      await conversations.createSession({
        id,
        userId: USER_ID,
        themeId: "food",
        themeTitle: "Comida",
        level: "A2",
        language: "en",
        episode: null,
        now: NOW,
      });
    }
    for (let turn = 0; turn < TURNS; turn += 1) {
      await conversations.addTurn({
        id: `44444444-4444-4444-8444-00000000000${turn}`,
        sessionId: BUSY,
        role: turn % 2 === 0 ? "tutor" : "user",
        text: `fala ${turn}`,
        translation: null,
        corrections: [],
        inputKind: "text",
        now: NOW,
      });
    }
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("a lista de conversas conta as falas de cada uma", async () => {
    const sessions = await conversations.listSessions(USER_ID, "en", 10);
    const turnsOf = (id: string) => sessions.find((session) => session.id === id)?.turnCount;
    expect(turnsOf(BUSY)).toBe(TURNS);
    expect(turnsOf(EMPTY)).toBe(0);
  });
});
