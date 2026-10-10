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
    for (let index = windowStart; index < pt.length; index += 1) {
      const difference = (pt[index]?.startMs ?? 0) - english.startMs;
      if (difference > MAX_OFFSET_SEARCH_MS) break;
      const bin = Math.round(difference / OFFSET_BIN_MS);
      differencesByBin.set(bin, [...(differencesByBin.get(bin) ?? []), difference]);
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
  const shifted = pt.map((cue) => ({ ...cue, startMs: cue.startMs - offsetMs, endMs: cue.endMs - offsetMs }));

  const alignments = en.map((english): CueAlignment => {
    const contributors = shifted
      .map((portuguese) => ({
        portuguese,
        overlap: Math.min(english.endMs, portuguese.endMs) - Math.max(english.startMs, portuguese.startMs),
      }))
      .filter(
        ({ portuguese, overlap }) =>
          overlap > 0 &&
          (overlap / duration(english) >= MIN_SHARE_OF_ENGLISH_CUE ||
            overlap / duration(portuguese) >= MIN_SHARE_OF_PORTUGUESE_CUE),
      );
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
