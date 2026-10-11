import { describe, expect, it } from "vitest";
import { rankCandidates } from "@/modules/subtitle-sources";
import { OpenSubtitlesProvider } from "./opensubtitles-provider";

const apiKey = process.env.OPENSUBTITLES_API_KEY;
const BREAKING_BAD_TMDB_ID = "1396";

describe.skipIf(!apiKey)("OpenSubtitles real, só busca", () => {
  it("encontra legendas em inglês e português de um episódio conhecido sem baixar nada", async () => {
    const provider = new OpenSubtitlesProvider({ apiKey: apiKey ?? "" });
    const candidates = await provider.search({
      kind: "episode",
      showTmdbId: BREAKING_BAD_TMDB_ID,
      seasonNumber: 1,
      episodeNumber: 1,
    });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((candidate) => /^\d+$/.test(candidate.fileId))).toBe(true);
    const ranking = rankCandidates(candidates);
    expect(ranking.english.length).toBeGreaterThan(0);
    expect(ranking.portuguese.length).toBeGreaterThan(0);
    expect(ranking.suggestion.english).not.toBeNull();
  });
});
