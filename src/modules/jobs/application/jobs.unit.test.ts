import { describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { SequentialIds } from "@/shared/ids";
import { backoffMs, JOB_LOCK_MS } from "../domain/job";
import type { JobPayloads } from "../domain/payloads";
import {
  makeEnqueueJob,
  makeHasPendingJob,
  makeRunClaimedJob,
  makeRunJobInline,
  makeRunNextJob,
  type JobHandlers,
} from "./job-queue";
import { InMemoryJobRepository } from "./testing/in-memory-job-repository";

const USER = "11111111-1111-4111-8111-111111111111";
const EPISODE = "22222222-2222-4222-8222-222222222222";
const BATCH = "33333333-3333-4333-8333-333333333333";

const audioPayload: JobPayloads["episode_audio"] = {
  userId: USER,
  episodeId: EPISODE,
  language: "en",
  voice: { voiceId: "af_heart", language: "en-us" },
  episodeLabel: "Série · T1E1",
};

function setup() {
  const jobs = new InMemoryJobRepository();
  const clock = new FixedClock(new Date("2026-10-15T12:00:00Z"));
  const calls: string[] = [];
  let audioFailures = 0;
  const handlers: JobHandlers = {
    generate_plan: async (payload) => {
      calls.push(`plan:${payload.episodeId}`);
    },
    card_batch: async (payload) => {
      calls.push(`cards:${payload.batchId}`);
    },
    refresh_recommendations: async (payload) => {
      calls.push(`recs:${payload.userId}`);
    },
    episode_audio: async (payload) => {
      calls.push(`audio:${payload.episodeId}`);
      if (audioFailures > 0) {
        audioFailures -= 1;
        throw new Error("Kokoro fora do ar");
      }
    },
    conversation_review: async (payload) => {
      calls.push(`review:${payload.sessionId}`);
    },
    conversation_terms: async (payload) => {
      calls.push(`terms:${payload.sessionId}`);
    },
    conversation_audio: async (payload) => {
      calls.push(`talk-audio:${payload.sessionId}`);
    },
    personal_series_description: async (payload) => {
      calls.push(`series:${payload.userId}`);
    },
    level_sources_sync: async (payload) => {
      calls.push(`levels:${payload.sourceId ?? "all"}`);
    },
    episode_level: async (payload) => {
      calls.push(`episode-level:${payload.episodeId}`);
    },
  };
  const run = makeRunClaimedJob({ jobs, handlers, clock });
  return {
    jobs,
    clock,
    calls,
    failAudio: (times: number) => {
      audioFailures = times;
    },
    enqueue: makeEnqueueJob({ jobs, clock, ids: new SequentialIds() }),
    runNext: makeRunNextJob({ jobs, run, clock }),
    runInline: makeRunJobInline({ jobs, run, clock }),
    hasPending: makeHasPendingJob({ jobs }),
  };
}

describe("fila de jobs", () => {
  it("executa o job mais antigo primeiro e marca como concluído", async () => {
    const t = setup();
    const first = await t.enqueue({
      kind: "generate_plan",
      payload: {
        userId: USER,
        episodeId: EPISODE,
        pair: { target: "en", native: "pt-BR" },
        level: "B1",
        episodeLabel: "x",
      },
    });
    t.clock.advanceMs(1000);
    await t.enqueue({
      kind: "card_batch",
      payload: {
        userId: USER,
        episodeId: EPISODE,
        batchId: BATCH,
        learnerLevel: "B1",
        pair: { target: "en", native: "pt-BR" },
        episodeLabel: "x",
      },
    });
    expect(await t.hasPending("generate_plan", { episodeId: EPISODE })).toBe(true);

    const outcome = await t.runNext();
    expect(outcome?.outcome).toBe("done");
    expect(outcome?.job.id).toBe(first.jobId);
    expect(t.calls).toEqual([`plan:${EPISODE}`]);
    expect((await t.jobs.find(first.jobId))?.status).toBe("DONE");
    expect(await t.hasPending("generate_plan", { episodeId: EPISODE })).toBe(false);

    expect((await t.runNext())?.outcome).toBe("done");
    expect(await t.runNext()).toBeNull();
    expect(t.calls).toEqual([`plan:${EPISODE}`, `cards:${BATCH}`]);
  });

  it("tenta de novo com espera crescente e desiste no limite de tentativas", async () => {
    const t = setup();
    t.failAudio(5);
    const { jobId } = await t.enqueue({ kind: "episode_audio", payload: audioPayload });

    const first = await t.runNext();
    expect(first).toMatchObject({ outcome: "retry", reason: "Kokoro fora do ar" });
    const stored = await t.jobs.find(jobId);
    expect(stored).toMatchObject({ status: "QUEUED", attempts: 1 });
    expect(stored?.runAfter.getTime()).toBe(t.clock.now().getTime() + backoffMs(1));

    expect(await t.runNext()).toBeNull();
    t.clock.advanceMs(backoffMs(1));
    expect((await t.runNext())?.outcome).toBe("retry");
    t.clock.advanceMs(backoffMs(2));
    const last = await t.runNext();
    expect(last).toMatchObject({ outcome: "failed", reason: "Kokoro fora do ar" });
    expect(await t.jobs.find(jobId)).toMatchObject({ status: "FAILED", attempts: 3 });
    expect(t.calls.filter((call) => call.startsWith("audio:"))).toHaveLength(3);
  });

  it("falha na hora quando o payload não bate com o schema do tipo", async () => {
    const t = setup();
    await t.jobs.enqueue({
      id: "broken",
      kind: "episode_audio",
      payload: { nope: true },
      maxAttempts: 3,
      runAfter: t.clock.now(),
      createdBy: null,
      now: t.clock.now(),
    });
    expect(await t.runNext()).toMatchObject({ outcome: "failed", reason: "INVALID_PAYLOAD" });
    expect(t.calls).toEqual([]);
  });

  it("recupera um job cujo bloqueio venceu sem o processo concluir", async () => {
    const t = setup();
    const { jobId } = await t.enqueue({ kind: "episode_audio", payload: audioPayload });
    const claimed = await t.jobs.claimNext(t.clock.now(), JOB_LOCK_MS);
    expect(claimed?.id).toBe(jobId);
    expect(await t.runNext()).toBeNull();
    t.clock.advanceMs(JOB_LOCK_MS + 1);
    const outcome = await t.runNext();
    expect(outcome).toMatchObject({ outcome: "done", job: { id: jobId, attempts: 2 } });
  });

  it("no modo embutido executa o job pedido e repete as tentativas sem esperar", async () => {
    const t = setup();
    t.failAudio(1);
    const { jobId } = await t.enqueue({ kind: "episode_audio", payload: audioPayload });
    const outcome = await t.runInline(jobId);
    expect(outcome?.outcome).toBe("done");
    expect(t.calls).toEqual([`audio:${EPISODE}`, `audio:${EPISODE}`]);
    expect(await t.runInline(jobId)).toBeNull();
  });
});
