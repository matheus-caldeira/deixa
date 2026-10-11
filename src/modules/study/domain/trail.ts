export type TrailLine = {
  cueId: string;
  startMs: number;
  text: string;
  sceneIndex: number;
  translation: string | null;
};

export type TrailIcon = "quote" | "ear" | "pen" | "chest";
export type TrailNode = {
  index: number;
  startMs: number;
  title: string;
  icon: TrailIcon;
  lines: TrailLine[];
};

export const MAX_TRAIL_NODES = 8;
const NODE_ICONS: readonly TrailIcon[] = ["quote", "ear", "pen"];
const FINAL_TITLE = "Desafio final";

function scenesOf(lines: readonly TrailLine[]): TrailLine[][] {
  const scenes: TrailLine[][] = [];
  for (const line of lines) {
    const last = scenes[scenes.length - 1];
    if (last && last[0]?.sceneIndex === line.sceneIndex) last.push(line);
    else scenes.push([line]);
  }
  return scenes;
}

function mergeEvenly(scenes: TrailLine[][], target: number): TrailLine[][] {
  if (scenes.length <= target) return scenes;
  const merged: TrailLine[][] = Array.from({ length: target }, () => []);
  scenes.forEach((scene, index) => {
    merged[Math.min(target - 1, Math.floor((index * target) / scenes.length))]?.push(...scene);
  });
  return merged.filter((group) => group.length > 0);
}

export function buildTrail(lines: readonly TrailLine[]): TrailNode[] {
  const groups = mergeEvenly(scenesOf(lines), MAX_TRAIL_NODES);
  return groups.map((group, index) => {
    const isFinal = groups.length > 1 && index === groups.length - 1;
    return {
      index,
      startMs: group[0]?.startMs ?? 0,
      title: isFinal ? FINAL_TITLE : `Cena ${index + 1}`,
      icon: isFinal ? "chest" : (NODE_ICONS[index % NODE_ICONS.length] ?? "quote"),
      lines: group,
    };
  });
}

export type NodeState = "done" | "current" | "locked";

export function nodeStates(nodeCount: number, completed: ReadonlySet<number>): NodeState[] {
  let unlocked = 0;
  while (unlocked < nodeCount && completed.has(unlocked)) unlocked += 1;
  return Array.from({ length: nodeCount }, (_, index) =>
    completed.has(index) ? "done" : index === unlocked ? "current" : "locked",
  );
}

export function trailProgressPercent(nodeCount: number, completed: ReadonlySet<number>): number {
  if (nodeCount === 0) return 0;
  const done = [...completed].filter((index) => index >= 0 && index < nodeCount).length;
  return Math.round((done / nodeCount) * 100);
}
