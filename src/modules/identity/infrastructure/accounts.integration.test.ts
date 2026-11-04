import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { count, eq, getTableColumns, getTableName, is, isNull, sql, type AnyColumn } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  FakeMetadataProvider,
  fakeExternalId,
} from "@/modules/catalog/infrastructure/fake-metadata-provider";
import { SilentTtsProvider } from "@/modules/audio/infrastructure/silent-tts-provider";
import { FakeLlmProvider } from "@/modules/learning/infrastructure/fake-llm-provider";
import { FakeTutorProvider } from "@/modules/conversations/infrastructure/fake-tutor-provider";
import { HashEmbeddingProvider } from "@/modules/recommendations/infrastructure/hash-embedding-provider";
import { parseEnv } from "@/infrastructure/config/env";
import { buildContainer, type Container } from "@/infrastructure/container";
import { silentLogger } from "@/infrastructure/logger/logger";
import type { DatabaseHandle } from "@/infrastructure/database/client";
import { openTestDatabase, testDatabaseAvailable } from "@/infrastructure/database/test-database";
import * as schema from "@/infrastructure/database/schema";
import { InMemoryFileStorage } from "@/shared/storage";
import { ensureSetupCode, readSetupCode } from "@/infrastructure/config/local-config";
import { fileSetupCodeGate } from "@/infrastructure/config/setup-code-gate";
import { nodePlatform } from "@/infrastructure/container";

const TEST_DATABASE = "deixa_accounts_test";
const PAIR = { target: "en", native: "pt-BR" } as const;
const USER_COLUMNS = new Set(["user_id", "owner_user_id"]);
const RULE_TABLES = [
  "user_preferences",
  "user_ai_credentials",
  "user_highlights",
  "highlight_card_batches",
  "user_cards",
  "episode_progress",
  "xp_events",
  "sessions",
  "user_recommendations",
  "recommendation_feedback",
  "recommendation_runs",
  "ai_usage_events",
  "ai_usage_limits",
  "user_ai_models",
  "user_language_pairs",
  "conversation_sessions",
  "personal_series",
  "episode_recaps",
  "learning_items",
];
const configDirectory = mkdtempSync(join(tmpdir(), "deixa-accounts-"));
const fixture = (name: string) => ({
  filename: name,
  bytes: new Uint8Array(readFileSync(`fixtures/${name}`)),
});
const person = (name: string) => ({
  name,
  email: `${name.toLowerCase()}@example.com`,
  password: "segredo123",
  level: "A1" as const,
});

const individualColumns: { table: string; column: AnyColumn }[] = Object.values(schema).flatMap((value) =>
  is(value, PgTable)
    ? Object.values(getTableColumns(value))
        .filter((column) => USER_COLUMNS.has(column.name))
        .map((column) => ({ table: getTableName(value), column }))
    : [],
);

describe.skipIf(!testDatabaseAvailable)("gestão de contas no banco", () => {
  let handle: DatabaseHandle & { url: string };
  let app: Container;
  let dona: string;
  let lucas: string;
  let bia: string;
  let episodeId: string;

  const rowsOf = async (userId: string) => {
    const counts: Record<string, number> = {};
    for (const { table, column } of individualColumns) {
      const [row] = await handle.db
        .select({ total: count() })
        .from(column.table as PgTable)
        .where(eq(column, userId));
      counts[table] = row?.total ?? 0;
    }
    return counts;
  };
  const total = async (table: PgTable) =>
    (await handle.db.select({ total: count() }).from(table))[0]?.total ?? 0;
  const study = async (userId: string) => {
    const view = await app.getReadingView(userId, episodeId, PAIR);
    const line = view.lines.find((candidate) => candidate.text.includes("picked up the tab"));
    if (!line) throw new Error("fala esperada");
    await app.syncHighlights({
      userId,
      pair: PAIR,
      episodeId,
      marks: [{ cueId: line.cueId, tokens: [2, 3, 4, 5], wholeLine: false }],
    });
    const batch = await app.generateCardDrafts({ userId, episodeId, learnerLevel: "A1", pair: PAIR });
    await app.confirmCardBatch({
      userId,
      pair: PAIR,
      batchId: batch.batchId,
      keepKeys: batch.drafts.map((draft) => draft.key),
      scope: "private",
    });
    const [card] = (await app.listDueCards(userId, PAIR)).cards;
    await app.gradeCard({ userId, pair: PAIR, cardId: card?.cardId ?? "", rating: "good" });
    const { sessionId } = await app.startConversation({
      userId,
      themeId: "travel",
      customTopic: null,
      level: "A1",
      language: "en",
    });
    await app.sendMessage({
      userId,
      sessionId,
      level: "A1",
      language: "en",
      message: { text: "I like the food" },
    });
    await app.enqueueJob({
      kind: "conversation_review",
      payload: { userId, sessionId, level: "A1" },
      createdBy: userId,
    });
    await app.saveCredential({
      actor: { userId, isAdmin: false },
      service: "gemini",
      scope: "user",
      secret: `AIza${"k".repeat(35)}`,
    });
    await app.signIn({ email: `${userId === lucas ? "lucas" : "bia"}@example.com`, password: "segredo123" });
  };

  beforeAll(async () => {
    handle = await openTestDatabase(TEST_DATABASE);
    const llm = new FakeLlmProvider();
    const tutor = new FakeTutorProvider();
    app = buildContainer({
      platform: { ...nodePlatform, setupCode: fileSetupCodeGate(() => configDirectory) },
      env: parseEnv({
        DATABASE_URL: handle.url,
        AI_CREDENTIALS_MASTER_KEY: Buffer.alloc(32, 7).toString("base64"),
      }),
      db: handle.db,
      logger: silentLogger,
      storage: new InMemoryFileStorage(),
      metadata: new FakeMetadataProvider(),
      tts: new SilentTtsProvider(),
      llmForUser: async () => llm,
      tutorForUser: async () => tutor,
      plannerForUser: async () => null,
      embeddingForUser: async () => new HashEmbeddingProvider(),
      suggestionWriterForUser: async () => null,
      testCredential: async () => true,
    });
  });

  afterAll(async () => {
    await handle?.close();
    rmSync(configDirectory, { recursive: true, force: true });
  });

  it("a primeira conta só nasce com o código de configuração e vira admin; as seguintes não", async () => {
    const code = ensureSetupCode(configDirectory);
    await expect(
      app.signUp({ ...person("Dona"), proof: { typedCode: "AAAA-BBBB-CCCC" } }),
    ).rejects.toMatchObject({ code: "SETUP_CODE_INVALID" });
    await expect(app.signUp(person("Dona"))).rejects.toMatchObject({ code: "SETUP_CODE_INVALID" });
    expect(await total(schema.users)).toBe(0);
    dona = (await app.signUp({ ...person("Dona"), proof: { typedCode: code.toLowerCase() } })).userId;
    expect(readSetupCode(configDirectory)).toBeNull();
    lucas = (await app.signUp(person("Lucas"))).userId;
    const created = await app.createAccount({
      actor: { userId: dona, isAdmin: true },
      ...person("Bia"),
      locale: "pt-BR",
    });
    bia = created.accountId;
    const accounts = await app.listAccounts({ actor: { userId: dona, isAdmin: true } });
    expect(accounts.map((account) => [account.email, account.isAdmin])).toEqual([
      ["dona@example.com", true],
      ["lucas@example.com", false],
      ["bia@example.com", false],
    ]);
    await expect(app.listAccounts({ actor: { userId: lucas, isAdmin: false } })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("remove a conta com todos os dados individuais, sem tocar no catálogo nem nos dados de outra conta", async () => {
    const { mediaId } = await app.registerWork({
      userId: lucas,
      type: "series",
      externalId: fakeExternalId("suits"),
    });
    const { episodes } = await app.loadSeasonEpisodes({ userId: lucas, mediaId, seasonNumber: 1 });
    episodeId = episodes[0]?.id ?? "";
    await app.importEpisodeSubtitles({
      userId: lucas,
      episodeId,
      target: { language: "en", upload: fixture("sample.en.srt") },
      native: { language: "pt-BR", upload: fixture("sample.pt-BR.srt") },
    });
    await study(lucas);
    await study(bia);

    expect(individualColumns.map((entry) => entry.table)).toEqual(expect.arrayContaining(RULE_TABLES));
    const before = await rowsOf(lucas);
    for (const table of ["sessions", "user_preferences", "user_highlights", "user_cards", "learning_items"]) {
      expect(before[table], table).toBeGreaterThan(0);
    }
    const biaBefore = await rowsOf(bia);
    const catalogBefore = {
      media: await total(schema.mediaItems),
      episodes: await total(schema.episodes),
      subtitles: await total(schema.subtitleFiles),
      cues: await total(schema.subtitleCues),
    };
    const biaLogs = await handle.db
      .select({ total: count() })
      .from(schema.reviewLogs)
      .innerJoin(schema.userCards, eq(schema.userCards.id, schema.reviewLogs.userCardId))
      .where(eq(schema.userCards.userId, bia));

    await app.removeAccount({ actor: { userId: dona, isAdmin: true }, accountId: lucas });

    const after = await rowsOf(lucas);
    expect(
      Object.values(after).every((value) => value === 0),
      JSON.stringify(after),
    ).toBe(true);
    expect(await rowsOf(bia)).toEqual(biaBefore);
    expect(await total(schema.users)).toBe(2);
    expect({
      media: await total(schema.mediaItems),
      episodes: await total(schema.episodes),
      subtitles: await total(schema.subtitleFiles),
      cues: await total(schema.subtitleCues),
    }).toEqual(catalogBefore);
    const [orphanUploads] = await handle.db
      .select({ total: count() })
      .from(schema.subtitleFiles)
      .where(isNull(schema.subtitleFiles.uploadedBy));
    expect(orphanUploads?.total).toBe(catalogBefore.subtitles);
    expect(await total(schema.reviewLogs)).toBe(biaLogs[0]?.total);
    const [pendingJobs] = await handle.db
      .select({ total: count() })
      .from(schema.jobQueue)
      .where(sql`${schema.jobQueue.payload} ->> 'userId' = ${lucas}`);
    expect(pendingJobs?.total).toBe(0);
    await expect(app.signIn({ email: "lucas@example.com", password: "segredo123" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    await expect(
      app.removeAccount({ actor: { userId: dona, isAdmin: true }, accountId: lucas }),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
  });

  it("redefinir a senha encerra as sessões da conta e troca a senha", async () => {
    const before = await rowsOf(bia);
    expect(before.sessions).toBeGreaterThan(0);
    await app.resetAccountPassword({
      actor: { userId: dona, isAdmin: true },
      accountId: bia,
      password: "nova-senha-1",
    });
    expect((await rowsOf(bia)).sessions).toBe(0);
    await expect(app.signIn({ email: "bia@example.com", password: "segredo123" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    await expect(app.signIn({ email: "bia@example.com", password: "nova-senha-1" })).resolves.toBeTruthy();
  });

  it("nunca deixa a instalação sem admin, nem por retirada nem por remoção", async () => {
    const admins = async () =>
      (await handle.db.select({ total: count() }).from(schema.users).where(eq(schema.users.isAdmin, true)))[0]
        ?.total;
    const asDona = { userId: dona, isAdmin: true };
    await expect(
      app.setAccountAdmin({ actor: asDona, accountId: dona, isAdmin: false }),
    ).rejects.toMatchObject({
      detail: { key: "lastAdmin" },
    });
    await expect(
      app.removeAccount({ actor: { userId: bia, isAdmin: true }, accountId: dona }),
    ).rejects.toMatchObject({ detail: { key: "lastAdmin" } });
    await app.setAccountAdmin({ actor: asDona, accountId: bia, isAdmin: true });
    expect(await admins()).toBe(2);
    await Promise.allSettled([
      app.setAccountAdmin({ actor: asDona, accountId: dona, isAdmin: false }),
      app.setAccountAdmin({ actor: { userId: bia, isAdmin: true }, accountId: bia, isAdmin: false }),
    ]);
    expect(await admins()).toBe(1);
    const [remaining] = await handle.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.isAdmin, true));
    const other = remaining?.id === dona ? bia : dona;
    await app.removeAccount({ actor: { userId: remaining?.id ?? "", isAdmin: true }, accountId: other });
    expect(await admins()).toBe(1);
    expect(await total(schema.users)).toBe(1);
  });
});
