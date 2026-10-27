import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/infrastructure/database/client";
import { openTestDatabase, testDatabaseAvailable } from "@/infrastructure/database/test-database";
import { JOB_LOCK_MS } from "../domain/job";
import { DrizzleJobRepository } from "./drizzle-job-repository";

const TEST_DATABASE = "deixa_test_jobs";

const payload = (episodeId: string) => ({
  userId: "11111111-1111-4111-8111-111111111111",
  episodeId,
  language: "en",
  voice: { voiceId: "af_heart", language: "en-us" },
  episodeLabel: "x",
});

describe.skipIf(!testDatabaseAvailable)("fila de jobs no Postgres real", () => {
  let handle: DatabaseHandle;
  let jobs: DrizzleJobRepository;

  beforeAll(async () => {
    handle = await openTestDatabase(TEST_DATABASE);
    jobs = new DrizzleJobRepository(handle.db);
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("dois processos pegando ao mesmo tempo recebem jobs diferentes (SKIP LOCKED)", async () => {
    const now = new Date("2026-10-15T12:00:00Z");
    for (const id of ["a", "b"]) {
      await jobs.enqueue({
        id: `00000000-0000-4000-8000-00000000000${id === "a" ? "1" : "2"}`,
        kind: "episode_audio",
        payload: payload(`00000000-0000-4000-8000-0000000000${id === "a" ? "11" : "22"}`),
        maxAttempts: 3,
        runAfter: now,
        createdBy: null,
        now: id === "a" ? now : new Date(now.getTime() + 1000),
      });
    }
    const claims = await Promise.all([jobs.claimNext(now, JOB_LOCK_MS), jobs.claimNext(now, JOB_LOCK_MS)]);
    const ids = claims.map((job) => job?.id).sort();
    expect(ids).toEqual(["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"]);
    expect(await jobs.claimNext(now, JOB_LOCK_MS)).toBeNull();

    expect(
      await jobs.countPending("episode_audio", { episodeId: "00000000-0000-4000-8000-000000000011" }),
    ).toEqual({
      queued: 0,
      running: 1,
    });
    await jobs.complete("00000000-0000-4000-8000-000000000001", now);
    await jobs.release(
      "00000000-0000-4000-8000-000000000002",
      { runAfter: new Date(now.getTime() + 60_000), reason: "falhou" },
      now,
    );
    expect(await jobs.claimById("00000000-0000-4000-8000-000000000002", now, JOB_LOCK_MS)).toBeNull();
    const later = new Date(now.getTime() + 60_000);
    const retried = await jobs.claimById("00000000-0000-4000-8000-000000000002", later, JOB_LOCK_MS);
    expect(retried).toMatchObject({ attempts: 2, status: "RUNNING", failureReason: "falhou" });
    await jobs.fail(retried?.id ?? "", "desisti", later);
    expect(await jobs.find(retried?.id ?? "")).toMatchObject({ status: "FAILED", failureReason: "desisti" });
    expect(await jobs.countPending("episode_audio", { language: "en" })).toEqual({ queued: 0, running: 0 });
  });
});
