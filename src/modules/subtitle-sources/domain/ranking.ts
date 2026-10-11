export type SourceLanguage = "en" | "pt-BR";

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
  english: SubtitleCandidate[];
  portuguese: SubtitleCandidate[];
  suggestion: {
    english: SubtitleCandidate | null;
    portuguese: SubtitleCandidate | null;
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

export function rankCandidates(candidates: readonly SubtitleCandidate[]): Ranking {
  const commonFps = mostCommonFps(candidates);
  const order = byQuality(commonFps);
  const ofLanguage = (language: SourceLanguage): SubtitleCandidate[] =>
    withoutMachineTranslation(candidates.filter((candidate) => candidate.language === language)).sort(order);
  const english = ofLanguage("en");
  const portuguese = ofLanguage("pt-BR");

  const portugueseByRelease = new Map<string, SubtitleCandidate>();
  for (const candidate of portuguese) {
    const key = releaseKey(candidate.release);
    if (key !== "" && !portugueseByRelease.has(key)) portugueseByRelease.set(key, candidate);
  }
  const pairs = english.flatMap((candidate) => {
    const match = portugueseByRelease.get(releaseKey(candidate.release));
    return match ? [{ english: candidate, portuguese: match }] : [];
  });
  const usablePairs = pairs.filter(
    (pair) => !pair.english.hearingImpaired && !pair.portuguese.hearingImpaired,
  );
  const bestPair = (usablePairs.length > 0 ? usablePairs : pairs).sort(
    (a, b) => b.english.downloads + b.portuguese.downloads - (a.english.downloads + a.portuguese.downloads),
  )[0];

  return {
    english,
    portuguese,
    suggestion: bestPair
      ? { ...bestPair, sameRelease: true }
      : { english: english[0] ?? null, portuguese: portuguese[0] ?? null, sameRelease: false },
  };
}
