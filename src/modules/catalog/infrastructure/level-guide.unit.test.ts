import { describe, expect, it } from "vitest";
import { CEFR_LEVELS } from "@/shared/levels";
import type { MetadataProvider, WorkCandidate, WorkDetails } from "../application/ports";
import { LevelGuidedMetadataProvider, levelGuideEntries, levelRangeOf } from "./level-guide";

const MIN_WORKS = 1000;
const MIN_PER_LEVEL = 40;
const FRIENDS_TMDB_ID = "tv:1668";
const UNKNOWN_TMDB_ID = "tv:999999999";

function details(externalId: string): WorkDetails {
  return {
    provider: "tmdb",
    externalId,
    type: "series",
    title: "Obra",
    originalTitle: "Obra",
    overview: "",
    year: 2000,
    posterPath: null,
    seasons: [],
    runtimeMinutes: null,
    levelRange: ["C2", "C2"],
  };
}

const candidate = (externalId: string): WorkCandidate => ({
  ...details(externalId),
  levelRange: undefined,
  genres: [],
  originalLanguage: "en",
  popularity: 1,
});

const inner: MetadataProvider = {
  name: "tmdb",
  searchWorks: async () => [details(FRIENDS_TMDB_ID)],
  getWork: async (_type, externalId) => details(externalId),
  getSeasonEpisodes: async () => [],
  listRelatedWorks: async () => [candidate(FRIENDS_TMDB_ID), candidate(UNKNOWN_TMDB_ID)],
  listPopularWorks: async () => [],
};

describe("guia de níveis", () => {
  it("classifica mais de mil obras e cobre todos os níveis", () => {
    const entries = levelGuideEntries();
    expect(entries.length).toBeGreaterThanOrEqual(MIN_WORKS);
    for (const level of CEFR_LEVELS) {
      expect(entries.filter((entry) => entry.range[0] === level).length).toBeGreaterThanOrEqual(
        MIN_PER_LEVEL,
      );
    }
    expect(levelRangeOf("series", FRIENDS_TMDB_ID)).toEqual(["B1", "B2"]);
    expect(levelRangeOf("movie", FRIENDS_TMDB_ID)).toBeNull();
    expect(levelRangeOf("movie", "movie:550")).toEqual(["C1", "C1"]);
  });

  it("preenche a faixa das obras conhecidas e mantém a do provider nas outras", async () => {
    const provider = new LevelGuidedMetadataProvider(inner);
    expect(provider.name).toBe("tmdb");
    expect((await provider.getWork("series", FRIENDS_TMDB_ID)).levelRange).toEqual(["B1", "B2"]);
    expect((await provider.getWork("series", UNKNOWN_TMDB_ID)).levelRange).toEqual(["C2", "C2"]);
    const related = await provider.listRelatedWorks("series", FRIENDS_TMDB_ID);
    expect(related.map((work) => work.levelRange)).toEqual([["B1", "B2"], undefined]);
    expect((await provider.searchWorks("friends"))[0]?.levelRange).toEqual(["B1", "B2"]);
  });
});
