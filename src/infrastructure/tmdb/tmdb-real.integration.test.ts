import { describe, expect, it } from "vitest";
import { TmdbClient } from "./client";
import { TmdbMetadataProvider } from "./tmdb-metadata-provider";

const readAccessToken = process.env.TMDB_READ_ACCESS_TOKEN;
const apiKey = process.env.TMDB_API_KEY;

describe.skipIf(!readAccessToken)("TMDB real", () => {
  const provider = new TmdbMetadataProvider(new TmdbClient({ readAccessToken, apiKey }));

  it("busca uma série conhecida e lê temporada e episódios em pt-BR", async () => {
    const results = await provider.searchWorks("Breaking Bad");
    const series = results.find((work) => work.type === "series" && work.originalTitle === "Breaking Bad");
    expect(series).toBeDefined();
    if (!series) return;
    expect(series.posterPath).toMatch(/^\//);
    expect(series.externalId).toMatch(/^tv:\d+$/);

    const details = await provider.getWork("series", series.externalId);
    expect(details.overview.length).toBeGreaterThan(0);
    expect(details.seasons.some((season) => season.seasonNumber === 1)).toBe(true);

    const episodes = await provider.getSeasonEpisodes(series.externalId, 1);
    expect(episodes.length).toBeGreaterThan(0);
    expect(episodes[0]?.episodeNumber).toBe(1);
    expect(episodes[0]?.title.length).toBeGreaterThan(0);
  });

  it("lê os detalhes de um filme", async () => {
    const results = await provider.searchWorks("The Social Network");
    const movie = results.find((work) => work.type === "movie");
    expect(movie).toBeDefined();
    if (!movie) return;
    const details = await provider.getWork("movie", movie.externalId);
    expect(details.type).toBe("movie");
    expect(details.runtimeMinutes).toBeGreaterThan(0);
  });
});
