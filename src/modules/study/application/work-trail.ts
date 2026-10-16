import type { CefrLevel } from "@/shared/levels";
import type { LanguagePair } from "@/shared/study-languages";
import { nodeStates, trailProgressPercent, type NodeState, type TrailIcon } from "../domain/trail";
import { placeholderStates, sectionStatus, type SectionStatus } from "../domain/work-trail";
import type { PlanRepository, StudyRepository } from "./study-use-cases";

export type WorkEpisode = {
  id: string;
  number: number;
  title: string;
  overview: string;
  ready: boolean;
  progressPercent: number | null;
};

export type WorkTrailNode = { index: number; title: string; icon: TrailIcon; state: NodeState };

export type WorkTrailSection = {
  episodeId: string;
  number: number;
  title: string;
  overview: string;
  status: SectionStatus;
  progressPercent: number;
  placeholder: boolean;
  nodes: WorkTrailNode[];
  currentIndex: number | null;
};

const ICONS: readonly TrailIcon[] = ["quote", "ear", "pen"];

export function makeGetWorkTrail(deps: { plans: PlanRepository; study: StudyRepository }) {
  return async function getWorkTrail(input: {
    userId: string;
    pair: LanguagePair;
    level: CefrLevel;
    currentEpisodeId: string | null;
    episodes: WorkEpisode[];
  }): Promise<WorkTrailSection[]> {
    return Promise.all(
      input.episodes.map(async (episode): Promise<WorkTrailSection> => {
        const stored = episode.ready ? await deps.plans.find(episode.id, input.pair, input.level) : null;
        const plan = stored?.status === "READY" ? stored.plan : null;
        const attempts = plan
          ? await deps.study.listAttempts(input.userId, episode.id, input.pair, input.level)
          : [];
        const completed = new Set(
          attempts.filter((attempt) => attempt.passed).map((attempt) => attempt.nodeIndex),
        );
        const states = plan
          ? nodeStates(plan.blocks.length, completed)
          : episode.ready
            ? placeholderStates()
            : [];
        const trailPercent = plan ? trailProgressPercent(plan.blocks.length, completed) : null;
        const isCurrent = episode.id === input.currentEpisodeId;
        const status = sectionStatus({
          ready: episode.ready,
          isCurrent,
          planPending: !plan,
          trailPercent,
          progressPercent: episode.progressPercent,
        });
        const current = states.indexOf("current");
        return {
          episodeId: episode.id,
          number: episode.number,
          title: episode.title,
          overview: episode.overview,
          status,
          progressPercent: trailPercent ?? episode.progressPercent ?? 0,
          placeholder: !plan,
          nodes: states.map((state, index) => {
            const block = plan?.blocks[index];
            return {
              index,
              title: block?.title ?? "",
              icon: block?.isFinal ? "chest" : (ICONS[index % ICONS.length] ?? "quote"),
              state: plan ? state : "locked",
            };
          }),
          currentIndex: plan && current >= 0 ? current : null,
        };
      }),
    );
  };
}
