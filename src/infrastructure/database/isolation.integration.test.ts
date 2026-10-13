import { readFileSync } from "node:fs";
import { count, eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  FakeMetadataProvider,
  fakeExternalId,
} from "@/modules/catalog/infrastructure/fake-metadata-provider";
import { SilentTtsProvider } from "@/modules/audio/infrastructure/silent-tts-provider";
import { FakeLlmProvider } from "@/modules/learning/infrastructure/fake-llm-provider";
import { HashEmbeddingProvider } from "@/modules/recommendations/infrastructure/hash-embedding-provider";
import {
  DrizzleAiUsageRepository,
  DrizzleModelPriceRepository,
  DrizzleUsageLimitRepository,
} from "@/modules/ai-usage/infrastructure/drizzle-ai-usage-repository";
import { InMemoryFileStorage } from "@/shared/storage";
import { parseEnv } from "../config/env";
import { buildContainer, type Container } from "../container";
import { silentLogger } from "../logger/logger";
import { openDatabase, type DatabaseHandle } from "./client";
import { runMigrations } from "./migrate";
import {
  highlightStats,
  learningItems,
  subtitleCues,
  subtitleFiles,
  userAiCredentials,
  users,
  workEmbeddings,
  xpEvents,
} from "./schema";

const TEST_DATABASE = "deixa_test";
const baseUrl = process.env.DATABASE_URL;
const fixture = (name: string) => ({
  filename: name,
  bytes: new Uint8Array(readFileSync(`fixtures/${name}`)),
});

function testDatabaseUrl(): string {
  const url = new URL(baseUrl ?? "postgres://deixa:deixa@localhost:1442/deixa");
  url.pathname = `/${TEST_DATABASE}`;
  return url.toString();
}

async function recreateDatabase(url: string): Promise<void> {
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = postgres(admin.toString(), { max: 1, onnotice: () => undefined });
  try {
    await client.unsafe(`DROP DATABASE IF EXISTS ${TEST_DATABASE} WITH (FORCE)`);
  } finally {
    await client.end({ timeout: 5 });
  }
  await runMigrations(url);
}

describe.skipIf(!baseUrl)("repositórios no Postgres real", () => {
  let handle: DatabaseHandle;
  let app: Container;
  let llm: FakeLlmProvider;
  let ana: string;
  let lucas: string;
  let episodeId: string;

  beforeAll(async () => {
    const url = testDatabaseUrl();
    await recreateDatabase(url);
    handle = openDatabase(url);
    llm = new FakeLlmProvider();
    app = buildContainer({
      env: parseEnv({ DATABASE_URL: url, AI_CREDENTIALS_MASTER_KEY: Buffer.alloc(32, 5).toString("base64") }),
      db: handle.db,
      logger: silentLogger,
      storage: new InMemoryFileStorage(),
      metadata: new FakeMetadataProvider(),
      tts: new SilentTtsProvider(),
      llmForUser: async () => llm,
      plannerForUser: async () => null,
      embeddingForUser: async () => new HashEmbeddingProvider(),
      suggestionWriterForUser: async () => null,
      testCredential: async () => true,
    });
    ana = (await app.signUp({ name: "Ana", email: "ana@example.com", password: "segredo123", level: "A1" }))
      .userId;
    lucas = (
      await app.signUp({ name: "Lucas", email: "lucas@example.com", password: "segredo123", level: "C1" })
    ).userId;
    const { mediaId } = await app.registerWork({
      userId: ana,
      type: "series",
      externalId: fakeExternalId("suits"),
    });
    const { episodes } = await app.loadSeasonEpisodes({ userId: ana, mediaId, seasonNumber: 1 });
    episodeId = episodes[0]?.id ?? "";
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("importa EN + PT, publica como READY e detecta o reenvio sem duplicar linhas", async () => {
    const upload = { episodeId, english: fixture("sample.en.srt"), portuguese: fixture("sample.pt-BR.srt") };
    const first = await app.importEpisodeSubtitles({ userId: ana, ...upload });
    expect(first).toMatchObject({ outcome: "PROCESSED", cueCount: 23, alignment: { pairs: 22 } });
    const context = await app.getEpisodeContext(episodeId);
    expect(context?.episode).toMatchObject({
      status: "READY",
      cueCount: 23,
      alignmentPairs: 22,
      hasPortuguese: true,
    });

    const again = await app.importEpisodeSubtitles({ userId: lucas, ...upload });
    expect(again.outcome).toBe("DUPLICATE");
    const [files] = await handle.db.select({ total: count() }).from(subtitleFiles);
    const [cues] = await handle.db.select({ total: count() }).from(subtitleCues);
    expect(files?.total).toBe(2);
    expect(cues?.total).toBe(45);
    const other = {
      filename: "outra.srt",
      bytes: new TextEncoder().encode("1\n00:00:01,000 --> 00:00:02,000\nOther\n"),
    };
    await expect(
      app.importEpisodeSubtitles({ userId: lucas, episodeId, english: other }),
    ).rejects.toMatchObject({
      code: "SUBTITLE_VERSION_CONFLICT",
    });
  });

  it("um usuário não vê marcações, cards, XP nem a chave de IA do outro", async () => {
    const view = await app.getReadingView(ana, episodeId);
    const line = view.lines.find((candidate) => candidate.text.includes("picked up the tab"));
    if (!line) throw new Error("fala esperada");
    await app.syncHighlights({
      userId: ana,
      episodeId,
      marks: [{ cueId: line.cueId, tokens: [2, 3, 4, 5], wholeLine: false }],
    });
    expect((await app.getReadingView(ana, episodeId)).highlights).toHaveLength(1);
    expect((await app.getReadingView(lucas, episodeId)).highlights).toHaveLength(0);

    const batch = await app.generateCardDrafts({ userId: ana, episodeId, learnerLevel: "A1" });
    await expect(
      app.confirmCardBatch({
        userId: lucas,
        batchId: batch.batchId,
        keepKeys: batch.drafts.map((d) => d.key),
        scope: "catalog",
      }),
    ).rejects.toMatchObject({ code: "BATCH_NOT_FOUND" });
    await app.confirmCardBatch({
      userId: ana,
      batchId: batch.batchId,
      keepKeys: batch.drafts.map((d) => d.key),
      scope: "private",
    });

    const anaQueue = await app.listDueCards(ana);
    expect(anaQueue.cards.map((card) => card.term)).toEqual(["picked up the tab"]);
    expect(anaQueue.cards[0]).toMatchObject({
      meaning: "pagou a conta (de todos)",
      contextTranslation: "Não. Eu paguei a conta, feito um idiota.",
      sourceLabel: "Suits · T1 · E1 · suas marcações",
    });
    expect((await app.listDueCards(lucas)).cards).toEqual([]);
    expect(await app.listCatalogSuggestions(episodeId)).toEqual([]);

    const [item] = await handle.db.select().from(learningItems).where(eq(learningItems.ownerUserId, ana));
    expect(item).toMatchObject({ visibility: "private" });
    await expect(app.getSpeakableItemText(lucas, item?.id ?? "")).rejects.toMatchObject({
      code: "ITEM_NOT_FOUND",
    });
    await expect(
      app.gradeCard({ userId: lucas, cardId: anaQueue.cards[0]?.cardId ?? "", rating: "easy" }),
    ).rejects.toMatchObject({ code: "CARD_NOT_FOUND" });

    const prefs = { dailyGoal: 100, timezone: "America/Sao_Paulo" };
    expect((await app.getProfileSummary({ userId: ana, ...prefs })).totalXp).toBe(10);
    expect((await app.getProfileSummary({ userId: lucas, ...prefs })).totalXp).toBe(0);

    const anaActor = { userId: ana, isAdmin: true };
    const lucasActor = { userId: lucas, isAdmin: false };
    const geminiKey = `AIza${"k".repeat(35)}`;
    await app.saveCredential({ actor: anaActor, service: "gemini", scope: "user", secret: geminiKey });
    await app.saveCredential({
      actor: anaActor,
      service: "opensubtitles",
      scope: "user",
      secret: "AbCdEfGhIjKlMnOpQrStUvWx",
    });
    const own = (actor: typeof anaActor) =>
      app
        .getCredentialOverview(actor)
        .then((list) => list.filter((entry) => entry.own.state === "ready").map((entry) => entry.service));
    expect(await own(anaActor)).toEqual(["gemini", "opensubtitles"]);
    expect(await own(lucasActor)).toEqual([]);
    await expect(
      app.saveCredential({ actor: lucasActor, service: "gemini", scope: "global", secret: geminiKey }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await app.saveCredential({ actor: anaActor, service: "gemini", scope: "global", secret: geminiKey });
    const forLucas = (await app.getCredentialOverview(lucasActor))[0];
    expect(forLucas).toMatchObject({ active: "global", global: { source: "database", stored: null } });
    await app.removeCredential({ actor: anaActor, service: "gemini", scope: "global" });
    await app.removeCredential({ actor: anaActor, service: "opensubtitles", scope: "user" });
    expect(await own(anaActor)).toEqual(["gemini"]);
    await handle.db.update(users).set({ isAdmin: false }).where(eq(users.id, ana));
    const signUps = await Promise.all(
      ["bia", "caio", "duda"].map((name) =>
        app.signUp({ name, email: `${name}@example.com`, password: "segredo123", level: "A1" }),
      ),
    );
    const admins = await handle.db.select({ id: users.id }).from(users).where(eq(users.isAdmin, true));
    expect(signUps).toHaveLength(3);
    expect(admins).toEqual([]);
    await handle.db.update(users).set({ isAdmin: true }).where(eq(users.id, ana));
    const [stored] = await handle.db.select().from(userAiCredentials);
    expect(stored?.encryptedApiKey).not.toContain("AIza");
  });

  it("o outro usuário gera o próprio card sem reaproveitar o privado; ao compartilhar, a contagem é anônima", async () => {
    const view = await app.getReadingView(lucas, episodeId);
    const line = view.lines.find((candidate) => candidate.text.includes("picked up the tab"));
    if (!line) throw new Error("fala esperada");
    const callsBefore = llm.requests.length;
    await app.syncHighlights({
      userId: lucas,
      episodeId,
      marks: [{ cueId: line.cueId, tokens: [2, 3, 4, 5], wholeLine: false }],
    });
    const batch = await app.generateCardDrafts({ userId: lucas, episodeId, learnerLevel: "C1" });
    expect(batch.drafts[0]?.reusedItemId).toBeNull();
    expect(llm.requests.length).toBe(callsBefore + 1);
    await app.confirmCardBatch({
      userId: lucas,
      batchId: batch.batchId,
      keepKeys: batch.drafts.map((d) => d.key),
      scope: "catalog",
    });

    expect(await app.listCatalogSuggestions(episodeId)).toMatchObject([{ term: "picked up the tab" }]);
    const [stat] = await handle.db.select().from(highlightStats);
    expect(stat).toMatchObject({ userCount: 1 });
    expect(
      (await app.getReadingView(ana, episodeId)).lines.every((entry) => entry.markedByCount === null),
    ).toBe(true);
    const [events] = await handle.db.select({ total: count() }).from(xpEvents);
    expect(events?.total).toBe(2);
  });

  it("o uso da IA de um usuário não aparece para o outro; preço por modelo é único", async () => {
    const usage = new DrizzleAiUsageRepository(handle.db);
    const prices = new DrizzleModelPriceRepository(handle.db);
    const now = new Date("2026-10-13T10:00:00Z");
    const base = {
      provider: "gemini",
      model: "gemini-2.5-flash",
      operation: "cards" as const,
      keySource: "user" as const,
      inputTokens: 100,
      outputTokens: 20,
      estimatedCostUsd: 0.00008,
      createdAt: now,
    };
    await usage.record({ ...base, id: crypto.randomUUID(), userId: ana });
    await usage.record({ ...base, id: crypto.randomUUID(), userId: ana, operation: "tutor" });
    await usage.record({ ...base, id: crypto.randomUUID(), userId: lucas });
    const since = new Date("2026-10-13T00:00:00Z");
    expect((await usage.listEvents(ana, since)).map((event) => event.operation).sort()).toEqual([
      "cards",
      "tutor",
    ]);
    expect((await usage.listEvents(lucas, since)).map((event) => event.userId)).toEqual([lucas]);

    const price = {
      provider: "gemini",
      model: "gemini-2.5-flash",
      inputUsdPerMillion: 1,
      outputUsdPerMillion: 2,
    };
    await prices.save(price, ana, now);
    await prices.save({ ...price, outputUsdPerMillion: 3 }, ana, now);
    expect(await prices.list()).toHaveLength(1);
    expect((await prices.find("gemini", "gemini-2.5-flash"))?.outputUsdPerMillion).toBe(3);

    const limits = new DrizzleUsageLimitRepository(handle.db);
    const limit = { usdPerDay: 0.5, usdPerMonth: null, tokensPerDay: null, tokensPerMonth: 1_000_000 };
    await limits.save(ana, "user", limit, ana, now);
    await limits.save(ana, "user", { ...limit, usdPerDay: 1 }, ana, now);
    expect(await limits.find(ana, "user")).toEqual({ ...limit, usdPerDay: 1 });
    expect(await limits.find(ana, "global")).toBeNull();
    expect(await limits.find(lucas, "user")).toBeNull();
    const totals = await usage.totalsByUser(since);
    expect(totals.find((entry) => entry.userId === ana)?.tokens).toBe(240);
    expect(totals.find((entry) => entry.userId === lucas)?.tokens).toBe(120);
  });

  it("gera o áudio uma vez e serve do cache no segundo pedido, para qualquer usuário", async () => {
    const first = await app.getSpeechAudio({ userId: ana, text: "Deal. First round's on me.", accent: "US" });
    const second = await app.getSpeechAudio({
      userId: lucas,
      text: "Deal. First round's on me.",
      accent: "US",
    });
    expect([first.cache, second.cache]).toEqual(["miss", "hit"]);
  });

  it("sugestões saem do estudo de cada um: lista, recusa e vetores não vazam entre usuários", async () => {
    await app.startEpisode(ana, episodeId);
    expect(await app.getRecommendations({ userId: ana, level: "A1" })).toMatchObject({
      status: "pending",
      refresh: true,
    });
    const [first, second] = await Promise.all([
      app.refreshRecommendations({ userId: ana, level: "A1" }),
      app.refreshRecommendations({ userId: ana, level: "A1" }),
    ]);
    expect([first.refreshed, second.refreshed].filter(Boolean)).toHaveLength(1);

    const forAna = await app.getRecommendations({ userId: ana, level: "A1" });
    expect(forAna).toMatchObject({ status: "ready", refresh: false, writtenByAi: false });
    expect(forAna.items.length).toBeGreaterThan(0);
    expect(forAna.items.map((item) => item.externalId)).not.toContain(fakeExternalId("suits"));
    expect(forAna.insight).toContain("pouco estudo");
    const forLucas = await app.getRecommendations({ userId: lucas, level: "C1" });
    expect(forLucas).toMatchObject({ status: "pending", items: [] });

    const refused = forAna.items[0];
    if (!refused) throw new Error("sugestão esperada");
    await expect(
      app.dismissRecommendation({ userId: lucas, workKey: refused.workKey }),
    ).rejects.toMatchObject({ code: "MEDIA_NOT_FOUND" });
    expect(await app.findRecommendation(lucas, refused.workKey)).toBeNull();
    await app.dismissRecommendation({ userId: ana, workKey: refused.workKey });
    const afterRefusal = await app.getRecommendations({ userId: ana, level: "A1" });
    expect(afterRefusal.items.map((item) => item.workKey)).not.toContain(refused.workKey);

    await app.refreshRecommendations({ userId: lucas, level: "C1" });
    const lucasItems = (await app.getRecommendations({ userId: lucas, level: "C1" })).items;
    expect(lucasItems.map((item) => item.workKey)).toContain(refused.workKey);
    const [vectors] = await handle.db.select({ total: count() }).from(workEmbeddings);
    expect(vectors?.total).toBeGreaterThan(0);
  });
});
