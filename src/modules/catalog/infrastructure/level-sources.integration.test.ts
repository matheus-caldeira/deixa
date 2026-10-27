import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/infrastructure/database/client";
import { openTestDatabase, testDatabaseAvailable } from "@/infrastructure/database/test-database";
import { DrizzleAiLevelRatingRepository } from "./drizzle-ai-level-rating-repository";
import { DrizzleLevelSourceRepository } from "./drizzle-level-source-repository";

const TEST_DATABASE = "deixa_test_level_sources";
const NOW = new Date("2026-10-20T12:00:00Z");
const ROOT = "11111111-1111-4111-8111-111111111111";
const CHILD = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

describe.skipIf(!testDatabaseAvailable)("fontes de nível no Postgres real", () => {
  let handle: DatabaseHandle;
  let sources: DrizzleLevelSourceRepository;

  beforeAll(async () => {
    handle = await openTestDatabase(TEST_DATABASE);
    sources = new DrizzleLevelSourceRepository(handle.db);
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("troca as avaliações a cada download, filtra fonte desligada ou com falha e apaga em cascata", async () => {
    await sources.add({
      id: ROOT,
      url: "https://a.example/i.json",
      parentId: null,
      createdBy: null,
      now: NOW,
    });
    await sources.add({
      id: CHILD,
      url: "https://b.example/c.json",
      parentId: ROOT,
      createdBy: null,
      now: NOW,
    });
    await sources.add({
      id: OTHER,
      url: "https://c.example/o.json",
      parentId: null,
      createdBy: null,
      now: NOW,
    });
    await sources.add({
      id: OTHER,
      url: "https://c.example/o.json",
      parentId: null,
      createdBy: null,
      now: NOW,
    });
    expect((await sources.list()).map((source) => source.status)).toEqual(["PENDING", "PENDING", "PENDING"]);

    await sources.saveRatings(ROOT, {
      name: "Índice",
      ratings: new Map([
        ["tv:1668", ["B1", "B2"] as const],
        ["movie:550", ["C1", "C1"] as const],
      ]),
      rejected: 2,
      now: NOW,
    });
    await sources.saveRatings(ROOT, {
      name: "Índice",
      ratings: new Map([["tv:1668", ["B2", "C1"] as const]]),
      rejected: 0,
      now: NOW,
    });
    await sources.saveRatings(CHILD, {
      name: null,
      ratings: new Map([["tv:1668", ["A2", "B1"] as const]]),
      rejected: 0,
      now: NOW,
    });
    await sources.saveFailure(OTHER, { reason: "status", status: 500, now: NOW });

    expect(await sources.find(ROOT)).toMatchObject({ name: "Índice", status: "READY", ratingCount: 1 });
    expect(await sources.find(OTHER)).toMatchObject({
      status: "FAILED",
      lastError: "status",
      lastStatus: 500,
    });
    const found = await sources.ratingsFor(["tv:1668", "movie:550"]);
    expect(found.get("tv:1668")?.map((rating) => [rating.sourceName, rating.range])).toEqual([
      ["Índice", ["B2", "C1"]],
      ["b.example", ["A2", "B1"]],
    ]);
    expect(found.has("movie:550")).toBe(false);

    await sources.setEnabled(CHILD, false, NOW);
    expect((await sources.ratingsFor(["tv:1668"])).get("tv:1668")).toHaveLength(1);

    await sources.removeChildrenExcept(ROOT, ["https://b.example/c.json"]);
    expect(await sources.find(CHILD)).not.toBeNull();
    await sources.remove(ROOT);
    expect((await sources.list()).map((source) => source.id)).toEqual([OTHER]);
    expect(await sources.ratingsFor(["tv:1668"])).toEqual(new Map());
  });

  it("guarda uma avaliação da IA por obra e troca ao avaliar de novo", async () => {
    const ai = new DrizzleAiLevelRatingRepository(handle.db);
    const base = {
      externalId: "tv:549",
      reason: "Jargão jurídico.",
      model: "m1",
      ratedBy: null,
      ratedAt: NOW,
    };
    await ai.save({ ...base, range: ["B2", "C1"] });
    await ai.save({ ...base, range: ["B1", "B2"], model: "m2" });
    expect(await ai.listIds()).toEqual(["tv:549"]);
    expect((await ai.ratingsFor(["tv:549", "tv:1"])).get("tv:549")).toMatchObject({
      range: ["B1", "B2"],
      model: "m2",
    });
    expect(await sources.ratedIds()).toEqual([]);
  });
});
