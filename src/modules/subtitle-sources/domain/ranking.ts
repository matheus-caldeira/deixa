import type { LanguagePair, StudyLanguage } from "@/shared/study-languages";

export type SourceLanguage = StudyLanguage;

export type SubtitleCandidate = {
  fileId: string;
  language: SourceLanguage;
  release: string;
  fileName: string;
  downloads: number;
  rating: number;
  hearingImpaired: boolean;
  machineTranslated: boolean;
  fps: number | null;
  uploader: string | null;
};

export type Ranking = {
  target: SubtitleCandidate[];
  native: SubtitleCandidate[];
  suggestion: {
    target: SubtitleCandidate | null;
    native: SubtitleCandidate | null;
    sameRelease: boolean;
  };
};

const NOISE_TOKENS = new Set([
  "srt",
  "sub",
  "subs",
  "en",
  "eng",
  "english",
  "pt",
  "ptbr",
  "pob",
  "por",
  "br",
  "portuguese",
  "brazilian",
  "es",
  "spa",
  "spanish",
  "espanol",
  "latino",
  "fr",
  "fre",
  "fra",
  "french",
  "francais",
  "legendado",
  "legenda",
  "hi",
  "sdh",
  "cc",
]);

export function normalizeRelease(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.(srt|sub|ass|vtt)$/i, "")
    .replace(/[^a-z0-9]+/g, ".")
    .split(".")
    .filter((token) => token.length > 0 && !NOISE_TOKENS.has(token))
    .join(".");
}

const RELEASE_MARKER =
  /(^|\.)(s\d{1,2}e\d{1,3}|\d{3,4}p|web|webrip|hdtv|bluray|brrip|bdrip|dvdrip|x264|x265|h264|h265|xvid|hevc)(\.|$)/;

export function releaseKey(name: string): string {
  const normalized = normalizeRelease(name);
  return RELEASE_MARKER.test(normalized) ? normalized : "";
}

function mostCommonFps(candidates: readonly SubtitleCandidate[]): number | null {
  const votes = new Map<number, number>();
  for (const candidate of candidates) {
    if (candidate.fps) votes.set(candidate.fps, (votes.get(candidate.fps) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestVotes = 0;
  for (const [fps, count] of votes) {
    if (count > bestVotes) {
      best = fps;
      bestVotes = count;
    }
  }
  return best;
}

function withoutMachineTranslation(candidates: SubtitleCandidate[]): SubtitleCandidate[] {
  const human = candidates.filter((candidate) => !candidate.machineTranslated);
  return human.length > 0 ? human : candidates;
}

function byQuality(commonFps: number | null) {
  const fpsPenalty = (candidate: SubtitleCandidate): number =>
    commonFps !== null && candidate.fps !== null && candidate.fps !== commonFps ? 1 : 0;
  return (a: SubtitleCandidate, b: SubtitleCandidate): number =>
    Number(a.hearingImpaired) - Number(b.hearingImpaired) ||
    fpsPenalty(a) - fpsPenalty(b) ||
    b.downloads - a.downloads ||
    b.rating - a.rating ||
    a.fileId.localeCompare(b.fileId);
}

export function rankCandidates(candidates: readonly SubtitleCandidate[], pair: LanguagePair): Ranking {
  const commonFps = mostCommonFps(candidates);
  const order = byQuality(commonFps);
  const ofLanguage = (language: SourceLanguage): SubtitleCandidate[] =>
    withoutMachineTranslation(candidates.filter((candidate) => candidate.language === language)).sort(order);
  const target = ofLanguage(pair.target);
  const native = ofLanguage(pair.native);

  const nativeByRelease = new Map<string, SubtitleCandidate>();
  for (const candidate of native) {
    const key = releaseKey(candidate.release);
    if (key !== "" && !nativeByRelease.has(key)) nativeByRelease.set(key, candidate);
  }
  const pairs = target.flatMap((candidate) => {
    const match = nativeByRelease.get(releaseKey(candidate.release));
    return match ? [{ target: candidate, native: match }] : [];
  });
  const usablePairs = pairs.filter((found) => !found.target.hearingImpaired && !found.native.hearingImpaired);
  const bestPair = (usablePairs.length > 0 ? usablePairs : pairs).sort(
    (a, b) => b.target.downloads + b.native.downloads - (a.target.downloads + a.native.downloads),
  )[0];

  return {
    target,
    native,
    suggestion: bestPair
      ? { ...bestPair, sameRelease: true }
      : { target: target[0] ?? null, native: native[0] ?? null, sameRelease: false },
  };
}
