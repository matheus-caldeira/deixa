export type TimedCue = { id: string; startMs: number; endMs: number };
export type AlignmentStatus = "ALIGNED" | "UNALIGNED";

export type CueAlignment = {
  enCueId: string;
  ptCueIds: string[];
  overlapScore: number;
  offsetMs: number;
  status: AlignmentStatus;
};

export type AlignmentResult = {
  alignments: CueAlignment[];
  offsetMs: number;
  alignedCount: number;
  rate: number;
};

export const ALIGNMENT_THRESHOLD = 0.6;
const MAX_OFFSET_SEARCH_MS = 5000;
const OFFSET_BIN_MS = 100;
const MIN_OFFSET_TO_APPLY_MS = 150;
const MIN_OFFSET_CONSENSUS = 0.5;
const MIN_SHARE_OF_ENGLISH_CUE = 0.2;
const MIN_SHARE_OF_PORTUGUESE_CUE = 0.5;
const MAX_CANDIDATES_PER_CUE = 64;
const MAX_CUE_SPAN_MS = 30_000;

function lastIndexStartingBefore(cues: readonly TimedCue[], limitMs: number): number {
  let low = 0;
  let high = cues.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if ((cues[middle]?.startMs ?? 0) < limitMs) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

const duration = (cue: TimedCue): number => Math.max(1, cue.endMs - cue.startMs);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  return sorted.length % 2 === 0 ? Math.round(((sorted[middle - 1] ?? upper) + upper) / 2) : upper;
}

export function estimateFixedOffset(en: readonly TimedCue[], pt: readonly TimedCue[]): number {
  if (en.length === 0 || pt.length === 0) return 0;
  const differencesByBin = new Map<number, number[]>();
  let windowStart = 0;
  for (const english of en) {
    while (
      windowStart < pt.length &&
      (pt[windowStart]?.startMs ?? 0) < english.startMs - MAX_OFFSET_SEARCH_MS
    ) {
      windowStart += 1;
    }
    const windowEnd = Math.min(pt.length, windowStart + MAX_CANDIDATES_PER_CUE);
    for (let index = windowStart; index < windowEnd; index += 1) {
      const difference = (pt[index]?.startMs ?? 0) - english.startMs;
      if (difference > MAX_OFFSET_SEARCH_MS) break;
      const bin = Math.round(difference / OFFSET_BIN_MS);
      const differences = differencesByBin.get(bin);
      if (differences) differences.push(difference);
      else differencesByBin.set(bin, [difference]);
    }
  }
  let bestBin = 0;
  let bestVotes = 0;
  for (const [bin, differences] of differencesByBin) {
    const votes = differences.length;
    if (votes > bestVotes || (votes === bestVotes && Math.abs(bin) < Math.abs(bestBin))) {
      bestBin = bin;
      bestVotes = votes;
    }
  }
  const neighborhood = [bestBin - 1, bestBin, bestBin + 1].flatMap((bin) => differencesByBin.get(bin) ?? []);
  const consensus = neighborhood.length / Math.min(en.length, pt.length);
  const offset = median(neighborhood);
  if (consensus < MIN_OFFSET_CONSENSUS || Math.abs(offset) < MIN_OFFSET_TO_APPLY_MS) return 0;
  return offset;
}

export function alignCues(enCues: readonly TimedCue[], ptCues: readonly TimedCue[]): AlignmentResult {
  const en = [...enCues].sort((a, b) => a.startMs - b.startMs);
  const pt = [...ptCues].sort((a, b) => a.startMs - b.startMs);
  const offsetMs = estimateFixedOffset(en, pt);
  const shifted = pt.map((cue) => ({
    ...cue,
    startMs: cue.startMs - offsetMs,
    endMs: Math.min(cue.endMs, cue.startMs + MAX_CUE_SPAN_MS) - offsetMs,
  }));

  const alignments = en.map((english): CueAlignment => {
    const contributors: { portuguese: TimedCue; overlap: number }[] = [];
    const earliestRelevantStart = english.startMs - MAX_CUE_SPAN_MS;
    let examined = 0;
    for (
      let index = lastIndexStartingBefore(shifted, english.endMs);
      index >= 0 && examined < MAX_CANDIDATES_PER_CUE;
      index -= 1, examined += 1
    ) {
      const portuguese = shifted[index];
      if (!portuguese || portuguese.startMs < earliestRelevantStart) break;
      const overlap =
        Math.min(english.endMs, portuguese.endMs) - Math.max(english.startMs, portuguese.startMs);
      const counts =
        overlap > 0 &&
        (overlap / duration(english) >= MIN_SHARE_OF_ENGLISH_CUE ||
          overlap / duration(portuguese) >= MIN_SHARE_OF_PORTUGUESE_CUE);
      if (counts) contributors.unshift({ portuguese, overlap });
    }
    const covered = contributors.reduce((total, { overlap }) => total + overlap, 0);
    const overlapScore = Math.min(1, Math.round((covered / duration(english)) * 1000) / 1000);
    const aligned = overlapScore >= ALIGNMENT_THRESHOLD;
    return {
      enCueId: english.id,
      ptCueIds: aligned ? contributors.map(({ portuguese }) => portuguese.id) : [],
      overlapScore,
      offsetMs,
      status: aligned ? "ALIGNED" : "UNALIGNED",
    };
  });

  const alignedCount = alignments.filter((alignment) => alignment.status === "ALIGNED").length;
  return {
    alignments,
    offsetMs,
    alignedCount,
    rate: en.length === 0 ? 0 : alignedCount / en.length,
  };
}
