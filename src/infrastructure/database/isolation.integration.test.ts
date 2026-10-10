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
      testApiKey: async () => true,
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
    const { episodes } = await app.loadSeasonEpisodes({ mediaId, seasonNumber: 1 });
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

    await app.saveApiKey(ana, `AIza${"k".repeat(35)}`);
    expect((await app.getKeyStatus(ana)).connected).toBe(true);
    expect(await app.getKeyStatus(lucas)).toEqual({ connected: false, masked: null });
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

  it("gera o áudio uma vez e serve do cache no segundo pedido, para qualquer usuário", async () => {
    const first = await app.getSpeechAudio({ userId: ana, text: "Deal. First round's on me.", accent: "US" });
    const second = await app.getSpeechAudio({
      userId: lucas,
      text: "Deal. First round's on me.",
      accent: "US",
    });
    expect([first.cache, second.cache]).toEqual(["miss", "hit"]);
  });
});
