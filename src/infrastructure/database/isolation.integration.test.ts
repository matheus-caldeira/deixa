import { readFileSync } from "node:fs";
import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  FakeMetadataProvider,
  fakeExternalId,
} from "@/modules/catalog/infrastructure/fake-metadata-provider";
import { voiceFor } from "@/modules/audio";
import { SilentTtsProvider } from "@/modules/audio/infrastructure/silent-tts-provider";
import { FakeLlmProvider } from "@/modules/learning/infrastructure/fake-llm-provider";
import { FakeTutorProvider } from "@/modules/conversations/infrastructure/fake-tutor-provider";
import { AesGcmCipher } from "@/modules/ai-credentials/infrastructure/aes-gcm-cipher";
import { DrizzleRecapRepository } from "@/modules/study/infrastructure/drizzle-recap-repository";
import { DrizzleModelChoiceRepository } from "@/modules/ai-credentials/infrastructure/drizzle-model-choice-repository";
import { DrizzleCatalogRepository } from "@/modules/catalog/infrastructure/drizzle-catalog-repository";
import { DrizzleLearningRepository } from "@/modules/learning/infrastructure/drizzle-learning-repository";
import { DrizzlePersonalData } from "@/modules/packages/infrastructure/drizzle-personal-data";
import { DrizzleSourceRepository } from "@/modules/subtitle-sources/infrastructure/drizzle-source-repository";
import { uuidGenerator } from "@/shared/ids";
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
import type { DatabaseHandle } from "./client";
import { openTestDatabase, testDatabaseAvailable } from "./test-database";
import {
  highlightStats,
  learningItems,
  personalEpisodeCards,
  subtitleCues,
  subtitleFiles,
  userAiCredentials,
  users,
  workEmbeddings,
  xpEvents,
} from "./schema";

const TEST_DATABASE = "deixa_test";
const tutor = new FakeTutorProvider();
const PAIR = { target: "en", native: "pt-BR" } as const;
const fixture = (name: string) => ({
  filename: name,
  bytes: new Uint8Array(readFileSync(`fixtures/${name}`)),
});

describe.skipIf(!testDatabaseAvailable)("repositórios no Postgres real", () => {
  let handle: DatabaseHandle & { url: string };
  let app: Container;
  let llm: FakeLlmProvider;
  let ana: string;
  let lucas: string;
  let episodeId: string;
  let mediaId: string;

  beforeAll(async () => {
    handle = await openTestDatabase(TEST_DATABASE);
    const url = handle.url;
    llm = new FakeLlmProvider();
    app = buildContainer({
      env: parseEnv({ DATABASE_URL: url, AI_CREDENTIALS_MASTER_KEY: Buffer.alloc(32, 5).toString("base64") }),
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
    ana = (await app.signUp({ name: "Ana", email: "ana@example.com", password: "segredo123", level: "A1" }))
      .userId;
    lucas = (
      await app.signUp({ name: "Lucas", email: "lucas@example.com", password: "segredo123", level: "C1" })
    ).userId;
    ({ mediaId } = await app.registerWork({
      userId: ana,
      type: "series",
      externalId: fakeExternalId("suits"),
    }));
    const { episodes } = await app.loadSeasonEpisodes({ userId: ana, mediaId, seasonNumber: 1 });
    episodeId = episodes[0]?.id ?? "";
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("importa EN + PT, publica como READY e detecta o reenvio sem duplicar linhas", async () => {
    const upload = {
      episodeId,
      target: { language: "en" as const, upload: fixture("sample.en.srt") },
      native: { language: "pt-BR" as const, upload: fixture("sample.pt-BR.srt") },
    };
    const first = await app.importEpisodeSubtitles({ userId: ana, ...upload });
    expect(first).toMatchObject({ outcome: "PROCESSED", cueCount: 23, alignment: { pairs: 22 } });
    const context = await app.getEpisodeContext(episodeId);
    expect(context?.episode).toMatchObject({
      status: "READY",
      cueCount: 23,
      alignmentPairs: 22,
      subtitleLanguages: ["en", "pt-BR"],
    });

    const season = await app.loadSeasonEpisodes({ userId: ana, mediaId, seasonNumber: 1 });
    expect(season.episodes.find((episode) => episode.id === episodeId)?.subtitleLanguages).toEqual([
      "en",
      "pt-BR",
    ]);

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
      app.importEpisodeSubtitles({ userId: lucas, episodeId, target: { language: "en", upload: other } }),
    ).rejects.toMatchObject({
      code: "SUBTITLE_VERSION_CONFLICT",
    });
  });

  it("um usuário não vê marcações, cards, XP nem a chave de IA do outro", async () => {
    const view = await app.getReadingView(ana, episodeId, PAIR);
    const line = view.lines.find((candidate) => candidate.text.includes("picked up the tab"));
    if (!line) throw new Error("fala esperada");
    await app.syncHighlights({
      userId: ana,
      pair: PAIR,
      episodeId,
      marks: [{ cueId: line.cueId, tokens: [2, 3, 4, 5], wholeLine: false }],
    });
    expect((await app.getReadingView(ana, episodeId, PAIR)).highlights).toHaveLength(1);
    expect((await app.getReadingView(lucas, episodeId, PAIR)).highlights).toHaveLength(0);

    const batch = await app.generateCardDrafts({ userId: ana, episodeId, learnerLevel: "A1", pair: PAIR });
    await expect(
      app.confirmCardBatch({
        userId: lucas,
        pair: PAIR,
        batchId: batch.batchId,
        keepKeys: batch.drafts.map((d) => d.key),
        scope: "catalog",
      }),
    ).rejects.toMatchObject({ code: "BATCH_NOT_FOUND" });
    await app.confirmCardBatch({
      userId: ana,
      pair: PAIR,
      batchId: batch.batchId,
      keepKeys: batch.drafts.map((d) => d.key),
      scope: "private",
    });

    const anaQueue = await app.listDueCards(ana, PAIR);
    expect(anaQueue.cards.map((card) => card.term)).toEqual(["picked up the tab"]);
    expect(anaQueue.cards[0]).toMatchObject({
      meaning: "pagou a conta (de todos)",
      contextTranslation: "Não. Eu paguei a conta, feito um idiota.",
      mediaTitle: "Suits",
      seasonNumber: 1,
      episodeNumber: 1,
      sourceKind: "highlight_private",
    });
    expect((await app.listDueCards(lucas, PAIR)).cards).toEqual([]);
    expect(await app.listCatalogSuggestions(episodeId, "en")).toEqual([]);

    const [item] = await handle.db.select().from(learningItems).where(eq(learningItems.ownerUserId, ana));
    expect(item).toMatchObject({ visibility: "private" });
    await expect(app.getSpeakableItem(lucas, item?.id ?? "")).rejects.toMatchObject({
      code: "ITEM_NOT_FOUND",
    });
    await expect(
      app.gradeCard({ userId: lucas, pair: PAIR, cardId: anaQueue.cards[0]?.cardId ?? "", rating: "easy" }),
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
    const view = await app.getReadingView(lucas, episodeId, PAIR);
    const line = view.lines.find((candidate) => candidate.text.includes("picked up the tab"));
    if (!line) throw new Error("fala esperada");
    const callsBefore = llm.requests.length;
    await app.syncHighlights({
      userId: lucas,
      pair: PAIR,
      episodeId,
      marks: [{ cueId: line.cueId, tokens: [2, 3, 4, 5], wholeLine: false }],
    });
    const batch = await app.generateCardDrafts({ userId: lucas, episodeId, learnerLevel: "C1", pair: PAIR });
    expect(batch.drafts[0]?.reusedItemId).toBeNull();
    expect(llm.requests.length).toBe(callsBefore + 1);
    await app.confirmCardBatch({
      userId: lucas,
      pair: PAIR,
      batchId: batch.batchId,
      keepKeys: batch.drafts.map((d) => d.key),
      scope: "catalog",
    });

    expect(await app.listCatalogSuggestions(episodeId, "en")).toMatchObject([{ term: "picked up the tab" }]);
    const [stat] = await handle.db.select().from(highlightStats);
    expect(stat).toMatchObject({ userCount: 1 });
    expect(
      (await app.getReadingView(ana, episodeId, PAIR)).lines.every((entry) => entry.markedByCount === null),
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
    await limits.save(ana, "global_cap", { ...limit, usdPerDay: 0.1 }, ana, now);
    expect((await limits.find(ana, "global_cap"))?.usdPerDay).toBe(0.1);
    expect((await limits.find(ana, "user"))?.usdPerDay).toBe(1);
    expect(await limits.find(lucas, "global_cap")).toBeNull();

    const choices = new DrizzleModelChoiceRepository(handle.db);
    const assigned = { provider: "gemini" as const, model: "gemini-2.5-flash-lite" };
    await choices.save(
      ana,
      { generation: { provider: "openai", model: "gpt-4o-mini" }, embedding: null },
      now,
    );
    await choices.saveAssigned(ana, assigned, lucas, now);
    await choices.saveAssigned(lucas, assigned, ana, now);
    expect(await choices.getAssigned(ana)).toEqual(assigned);
    expect((await choices.get(ana))?.generation?.model).toBe("gpt-4o-mini");
    expect(await choices.get(lucas)).toEqual({ generation: null, embedding: null });
    await choices.saveAssigned(lucas, null, ana, now);
    expect(await choices.getAssigned(lucas)).toBeNull();
    expect((await choices.listAssigned()).map((entry) => entry.userId)).toEqual([ana]);
    const recaps = new DrizzleRecapRepository(handle.db);
    const recapRow = {
      userId: ana,
      source: "personal" as const,
      episodeId: crypto.randomUUID(),
      pair: "en>pt-BR",
      dueAt: now,
    };
    await recaps.ensure([{ ...recapRow, id: crypto.randomUUID() }], now);
    await recaps.ensure([{ ...recapRow, id: crypto.randomUUID() }], now);
    const [anaRecap] = await recaps.list(ana, "en>pt-BR");
    expect(await recaps.list(ana, "en>pt-BR")).toHaveLength(1);
    expect(await recaps.list(lucas, "en>pt-BR")).toEqual([]);
    expect(await recaps.find(lucas, "en>pt-BR", anaRecap?.id ?? "")).toBeNull();
    expect(await recaps.find(ana, "es>pt-BR", anaRecap?.id ?? "")).toBeNull();
    await recaps.saveStep(lucas, anaRecap?.id ?? "", 2, null, now);
    expect((await recaps.find(ana, "en>pt-BR", anaRecap?.id ?? ""))?.step).toBe(0);
    await recaps.saveStep(ana, anaRecap?.id ?? "", 1, now, now);
    expect((await recaps.find(ana, "en>pt-BR", anaRecap?.id ?? ""))?.step).toBe(1);
    const totals = await usage.totalsByUser(since);
    expect(totals.find((entry) => entry.userId === ana)?.tokens).toBe(240);
    expect(totals.find((entry) => entry.userId === lucas)?.tokens).toBe(120);
  });

  it("gera o áudio uma vez e serve do cache no segundo pedido, para qualquer usuário", async () => {
    const first = await app.getSpeechAudio({
      userId: ana,
      text: "Deal. First round's on me.",
      voice: voiceFor("en", "US"),
    });
    const second = await app.getSpeechAudio({
      userId: lucas,
      text: "Deal. First round's on me.",
      voice: voiceFor("en", "US"),
    });
    expect([first.cache, second.cache]).toEqual(["miss", "hit"]);
  });

  it("sugestões saem do estudo de cada um: lista, recusa e vetores não vazam entre usuários", async () => {
    await app.startEpisode(ana, episodeId);
    expect(await app.getRecommendations({ userId: ana, level: "A1", language: "en" })).toMatchObject({
      status: "pending",
      refresh: true,
    });
    const [first, second] = await Promise.all([
      app.refreshRecommendations({ userId: ana, level: "A1", language: "en" }),
      app.refreshRecommendations({ userId: ana, level: "A1", language: "en" }),
    ]);
    expect([first.refreshed, second.refreshed].filter(Boolean)).toHaveLength(1);

    const forAna = await app.getRecommendations({ userId: ana, level: "A1", language: "en" });
    expect(forAna).toMatchObject({ status: "ready", refresh: false, writtenByAi: false });
    expect(forAna.items.length).toBeGreaterThan(0);
    expect(forAna.items.map((item) => item.externalId)).not.toContain(fakeExternalId("suits"));
    expect(forAna.insight).toContain("accuracyPercent");
    const forLucas = await app.getRecommendations({ userId: lucas, level: "C1", language: "en" });
    expect(forLucas).toMatchObject({ status: "pending", items: [] });

    const refused = forAna.items[0];
    if (!refused) throw new Error("sugestão esperada");
    await expect(
      app.dismissRecommendation({ userId: lucas, workKey: refused.workKey }),
    ).rejects.toMatchObject({ code: "MEDIA_NOT_FOUND" });
    expect(await app.findRecommendation(lucas, refused.workKey)).toBeNull();
    await app.dismissRecommendation({ userId: ana, workKey: refused.workKey });
    const afterRefusal = await app.getRecommendations({ userId: ana, level: "A1", language: "en" });
    expect(afterRefusal.items.map((item) => item.workKey)).not.toContain(refused.workKey);

    await app.refreshRecommendations({ userId: lucas, level: "C1", language: "en" });
    const lucasItems = (await app.getRecommendations({ userId: lucas, level: "C1", language: "en" })).items;
    expect(lucasItems.map((item) => item.workKey)).toContain(refused.workKey);
    const [vectors] = await handle.db.select({ total: count() }).from(workEmbeddings);
    expect(vectors?.total).toBeGreaterThan(0);
  });

  it("conversa encerrada vira cards na série pessoal de quem conversou, sem duplicar nem vazar", async () => {
    const { sessionId } = await app.startConversation({
      userId: ana,
      themeId: "travel",
      customTopic: null,
      level: "A1",
      language: "en",
    });
    for (const text of ["He go to the beach", "Peoples are nice there", "I like the food"]) {
      await app.sendMessage({ userId: ana, sessionId, level: "A1", language: "en", message: { text } });
    }
    await expect(
      app.closeConversation({ userId: lucas, sessionId, language: "en", withReview: true }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const closed = await app.closeConversation({ userId: ana, sessionId, language: "en", withReview: true });
    expect(closed).toEqual({ xpAwarded: 15, reviewQueued: true });
    await expect(
      app.sendMessage({ userId: ana, sessionId, level: "A1", language: "en", message: { text: "hi" } }),
    ).rejects.toMatchObject({ detail: { key: "conversationClosed" } });

    const { jobId } = await app.enqueueJob({
      kind: "conversation_review",
      payload: { userId: ana, sessionId, level: "A1" },
      createdBy: ana,
    });
    await app.runJobInline(jobId);
    const reviewed = await app.getConversation(ana, sessionId, "en");
    expect(reviewed.session.reviewStatus).toBe("ready");
    expect(reviewed.session.review?.difficulties.map((item) => item.target)).toEqual(["he goes", "people"]);
    expect(reviewed.turns[1]?.correctedText).toBe("he goes to the beach");

    const confirmed = await app.confirmConversationCards({
      userId: ana,
      sessionId,
      language: "en",
      difficultyIds: ["d0", "d1"],
    });
    expect(confirmed).toEqual({ cards: 2, newEpisodes: 2 });
    await expect(
      app.confirmConversationCards({ userId: ana, sessionId, language: "en", difficultyIds: ["d0"] }),
    ).rejects.toMatchObject({ detail: { key: "cardsAlreadyConfirmed" } });

    const series = await app.getPersonalSeries({ userId: ana, pair: PAIR, userLevel: "A1" });
    const episodes = series.seasons.flatMap((season) => season.episodes);
    expect(series.seasons.map((season) => season.level)).toEqual(["A1"]);
    expect(episodes.map((episode) => [episode.title, episode.cardCount, episode.sourceCount])).toEqual([
      ["Verbos", 1, 1],
      ["Plural", 1, 1],
    ]);
    const trail = await app.getPersonalEpisodeTrail({
      userId: ana,
      pair: PAIR,
      episodeId: episodes[0]?.id ?? "",
    });
    expect(trail.sources).toEqual([expect.objectContaining({ sessionId, themeId: "travel" })]);
    expect(trail.nodes).toHaveLength(1);

    const lucasSeries = await app.getPersonalSeries({ userId: lucas, pair: PAIR, userLevel: "C1" });
    expect(lucasSeries.series.id).not.toBe(series.series.id);
    expect(lucasSeries.seasons.flatMap((season) => season.episodes)).toEqual([]);
    await expect(
      app.getPersonalEpisodeTrail({ userId: lucas, pair: PAIR, episodeId: episodes[0]?.id ?? "" }),
    ).rejects.toMatchObject({ code: "ITEM_NOT_FOUND" });
    await expect(
      app.startPersonalLesson({
        userId: lucas,
        pair: PAIR,
        level: "C1",
        episodeId: episodes[0]?.id ?? "",
        nodeIndex: 0,
      }),
    ).rejects.toMatchObject({ code: "ITEM_NOT_FOUND" });

    await app.renamePersonalSeries({ userId: ana, pair: PAIR, userLevel: "A1", name: "Inglês da Ana" });
    await app.setPersonalSeriesLevel({
      userId: ana,
      pair: PAIR,
      userLevel: "A1",
      level: { mode: "custom", min: "A1", max: "B1" },
    });
    const renamed = await app.getPersonalSeries({ userId: ana, pair: PAIR, userLevel: "A1" });
    expect(renamed.series).toMatchObject({
      id: series.series.id,
      name: "Inglês da Ana",
      level: { mode: "custom", min: "A1", max: "B1" },
    });
    const [cards] = await handle.db.select({ total: count() }).from(personalEpisodeCards);
    expect(cards?.total).toBe(2);

    const personal = new DrizzlePersonalData({
      db: handle.db,
      catalog: new DrizzleCatalogRepository(handle.db),
      learning: new DrizzleLearningRepository(handle.db),
      keyCipher: new AesGcmCipher(Buffer.alloc(32, 5).toString("base64")),
      ids: uuidGenerator,
    });
    const exported = await personal.collect(ana, false);
    expect(exported.personalSeries).toEqual([
      expect.objectContaining({
        name: "Inglês da Ana",
        levelMode: "custom",
        seasons: [
          expect.objectContaining({
            level: "A1",
            episodes: [
              expect.objectContaining({
                title: "Verbos",
                cards: [expect.objectContaining({ term: "he goes" })],
              }),
              expect.objectContaining({
                title: "Plural",
                cards: [expect.objectContaining({ term: "people" })],
              }),
            ],
          }),
        ],
      }),
    ]);
    const report = await personal.merge(lucas, exported, new Date());
    expect(report.seriesEpisodes).toBe(2);
    expect((await personal.merge(lucas, exported, new Date())).seriesEpisodes).toBe(0);
    const imported = await app.getPersonalSeries({ userId: lucas, pair: PAIR, userLevel: "C1" });
    expect(imported.series.name).toBe("Inglês da Ana");
    expect(
      imported.seasons
        .find((season) => season.level === "A1")
        ?.episodes.map((episode) => [episode.title, episode.cardCount]),
    ).toEqual([
      ["Verbos", 1],
      ["Plural", 1],
    ]);
    const [allCards] = await handle.db.select({ total: count() }).from(personalEpisodeCards);
    expect(allCards?.total).toBe(4);
  });
  it("a busca de legendas guardada devolve espanhol e francês, não só inglês e português", async () => {
    const sources = new DrizzleSourceRepository(handle.db);
    const candidate = (fileId: string, language: "es" | "fr" | "pt-BR") => ({
      fileId,
      language,
      release: "Suits.S01E01",
      fileName: `${fileId}.srt`,
      downloads: 1,
      rating: 0,
      hearingImpaired: false,
      machineTranslated: false,
      fps: null,
      uploader: null,
    });
    const fetchedAt = new Date("2026-11-03T12:00:00Z");
    await sources.saveSearch(episodeId, "fake", {
      languages: ["es", "pt-BR", "fr"],
      candidates: [candidate("es-1", "es"), candidate("pt-1", "pt-BR"), candidate("fr-1", "fr")],
      fetchedAt,
    });
    const cached = await sources.getCachedSearch(episodeId, "fake");
    expect(cached?.languages).toEqual(["es", "pt-BR", "fr"]);
    expect(cached?.candidates.map((entry) => entry.language)).toEqual(["es", "pt-BR", "fr"]);
  });
});
