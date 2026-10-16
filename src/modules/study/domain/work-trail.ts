import type { NodeState } from "./trail";

export type SectionStatus = "done" | "current" | "open" | "pending" | "missing";

export const PLACEHOLDER_NODES = 4;
const COMPLETE = 100;

export function sectionStatus(input: {
  ready: boolean;
  isCurrent: boolean;
  planPending: boolean;
  trailPercent: number | null;
  progressPercent: number | null;
}): SectionStatus {
  if (!input.ready) return "missing";
  const percent = input.trailPercent ?? input.progressPercent ?? 0;
  if (percent >= COMPLETE) return "done";
  if (input.isCurrent) return input.planPending ? "pending" : "current";
  return "open";
}

export function placeholderStates(count = PLACEHOLDER_NODES): NodeState[] {
  return Array.from({ length: count }, () => "locked");
}

export function currentSectionKey<T extends { key: string; status: SectionStatus }>(
  sections: readonly T[],
): string | null {
  const current = sections.find((section) => section.status === "current" || section.status === "pending");
  if (current) return current.key;
  return sections.find((section) => section.status === "open")?.key ?? null;
}
