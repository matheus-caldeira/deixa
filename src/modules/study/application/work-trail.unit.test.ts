import { describe, expect, it } from "vitest";
import type { CefrLevel } from "@/shared/levels";
import type { LanguagePair } from "@/shared/study-languages";
import type { LessonPlan } from "../domain/plan";
import { currentSectionKey, sectionStatus } from "../domain/work-trail";
import type { PlanRepository, StoredPlan, StudyRepository } from "./study-use-cases";
import { makeGetWorkTrail, type WorkEpisode } from "./work-trail";

const PAIR: LanguagePair = { target: "en", native: "pt-BR" };

function planWith(blocks: number): LessonPlan {
  return {
    blocks: Array.from({ length: blocks }, (_, index) => ({
      index,
      title: `Bloco ${index + 1}`,
      isFinal: index === blocks - 1,
    })),
  } as unknown as LessonPlan;
}

function setup(input: {
  plans: Record<string, StoredPlan>;
  passed: { userId: string; episodeId: string; nodeIndex: number }[];
}) {
  const plans = {
    find: async (episodeId: string, _pair: LanguagePair, _level: CefrLevel) => input.plans[episodeId] ?? null,
  } as unknown as PlanRepository;
  const study: StudyRepository = {
    listAttempts: async (userId, episodeId) =>
      input.passed
        .filter((attempt) => attempt.userId === userId && attempt.episodeId === episodeId)
        .map((attempt) => ({ nodeIndex: attempt.nodeIndex, passed: true, createdAt: new Date(0) })),
    saveAttempt: async () => {},
  };
  return makeGetWorkTrail({ plans, study });
}

const ready = (plan: LessonPlan): StoredPlan => ({
  status: "READY",
  plan,
  failureReason: null,
  updatedAt: new Date(0),
});

const episode = (id: string, number: number, extra: Partial<WorkEpisode> = {}): WorkEpisode => ({
  id,
  number,
  title: `Episódio ${number}`,
  overview: "",
  ready: true,
  progressPercent: null,
  ...extra,
});

describe("trilha da obra", () => {
  it("classifica cada seção: feita, atual, aberta, montando e sem legenda", () => {
    const base = { ready: true, isCurrent: false, planPending: false, trailPercent: 0, progressPercent: 0 };
    expect(sectionStatus({ ...base, trailPercent: 100 })).toBe("done");
    expect(sectionStatus({ ...base, trailPercent: null, progressPercent: 100 })).toBe("done");
    expect(sectionStatus({ ...base, isCurrent: true, trailPercent: 40 })).toBe("current");
    expect(sectionStatus({ ...base, isCurrent: true, planPending: true, trailPercent: null })).toBe(
      "pending",
    );
    expect(sectionStatus({ ...base, trailPercent: 40 })).toBe("open");
    expect(sectionStatus({ ...base, ready: false, isCurrent: true })).toBe("missing");
    expect(
      currentSectionKey([
        { key: "a", status: "done" },
        { key: "b", status: "open" },
        { key: "c", status: "current" },
      ]),
    ).toBe("c");
    expect(currentSectionKey([{ key: "a", status: "missing" }])).toBeNull();
  });

  it("monta uma seção por episódio com os nós do plano e o progresso da própria pessoa", async () => {
    const getWorkTrail = setup({
      plans: { e1: ready(planWith(3)), e2: ready(planWith(4)) },
      passed: [
        { userId: "ana", episodeId: "e1", nodeIndex: 0 },
        { userId: "ana", episodeId: "e1", nodeIndex: 1 },
        { userId: "ana", episodeId: "e1", nodeIndex: 2 },
        { userId: "ana", episodeId: "e2", nodeIndex: 0 },
        { userId: "lucas", episodeId: "e2", nodeIndex: 1 },
      ],
    });
    const sections = await getWorkTrail({
      userId: "ana",
      pair: PAIR,
      level: "B1",
      currentEpisodeId: "e2",
      episodes: [episode("e1", 1), episode("e2", 2), episode("e3", 3), episode("e4", 4, { ready: false })],
    });
    expect(sections.map((section) => section.status)).toEqual(["done", "current", "open", "missing"]);
    expect(sections[1]?.nodes.map((node) => node.state)).toEqual(["done", "current", "locked", "locked"]);
    expect(sections[1]?.currentIndex).toBe(1);
    expect(sections[1]?.nodes[3]?.icon).toBe("chest");
    expect(sections[2]?.placeholder).toBe(true);
    expect(sections[2]?.nodes.every((node) => node.state === "locked")).toBe(true);
    expect(sections[3]?.nodes).toEqual([]);
    expect(sections[0]?.progressPercent).toBe(100);
  });

  it("o episódio atual sem plano pronto aparece como trilha em montagem", async () => {
    const getWorkTrail = setup({ plans: {}, passed: [] });
    const [section] = await getWorkTrail({
      userId: "ana",
      pair: PAIR,
      level: "B1",
      currentEpisodeId: "e1",
      episodes: [episode("e1", 1)],
    });
    expect(section?.status).toBe("pending");
    expect(section?.currentIndex).toBeNull();
  });
});
