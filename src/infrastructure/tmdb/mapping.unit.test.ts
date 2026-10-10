import { describe, expect, it } from "vitest";
import {
  mapMovieDetails,
  mapSearchResults,
  mapSeasonEpisodes,
  mapTvDetails,
  needsEnglishFallback,
  seasonNeedsEnglishFallback,
  tmdbExternalId,
  tmdbNumericId,
} from "./mapping";
import { movieDetailsSchema, searchMultiSchema, seasonDetailsSchema, tvDetailsSchema } from "./schemas";

describe("mapeamento da resposta do TMDB", () => {
  it("mapeia a busca, ignora pessoas e guarda o título original", () => {
    const localized = searchMultiSchema.parse({
      results: [
        {
          id: 10,
          media_type: "tv",
          name: "Uma Série",
          original_name: "A Show",
          overview: "Sinopse.",
          first_air_date: "2005-09-19",
          poster_path: "/a.jpg",
        },
        { id: 11, media_type: "person", name: "Alguém" },
        {
          id: 12,
          media_type: "movie",
          title: "Um Filme",
          original_title: "A Movie",
          overview: "",
          release_date: "",
          poster_path: null,
        },
      ],
    });
    expect(mapSearchResults(localized)).toEqual([
      {
        provider: "tmdb",
        externalId: "tv:10",
        type: "series",
        title: "Uma Série",
        originalTitle: "A Show",
        overview: "Sinopse.",
        year: 2005,
        posterPath: "/a.jpg",
      },
      {
        provider: "tmdb",
        externalId: "movie:12",
        type: "movie",
        title: "Um Filme",
        originalTitle: "A Movie",
        overview: "",
        year: null,
        posterPath: null,
      },
    ]);
  });

  it("preenche título e sinopse vazios com a resposta em inglês", () => {
    const localized = searchMultiSchema.parse({
      results: [{ id: 12, media_type: "movie", title: "", original_title: "A Movie", overview: "" }],
    });
    const english = searchMultiSchema.parse({
      results: [
        {
          id: 12,
          media_type: "movie",
          title: "A Movie",
          original_title: "A Movie",
          overview: "Plot.",
          poster_path: "/m.jpg",
        },
      ],
    });
    expect(mapSearchResults(localized, english)).toMatchObject([
      { title: "A Movie", overview: "Plot.", posterPath: "/m.jpg" },
    ]);
  });

  it("mapeia a série com temporadas e cai para o inglês só no que faltou", () => {
    const localized = tvDetailsSchema.parse({
      id: 10,
      name: "Uma Série",
      original_name: "A Show",
      overview: "",
      first_air_date: "2005-09-19",
      poster_path: "/a.jpg",
      episode_run_time: [22],
      seasons: [
        { season_number: 0, name: "Especiais", episode_count: 3 },
        { season_number: 1, name: "", episode_count: 22 },
      ],
    });
    const english = tvDetailsSchema.parse({
      id: 10,
      name: "A Show",
      original_name: "A Show",
      overview: "Plot in English.",
      seasons: [{ season_number: 1, name: "Season 1", episode_count: 22 }],
    });
    expect(needsEnglishFallback({ title: "Uma Série", overview: "" })).toBe(true);
    expect(mapTvDetails(localized, english)).toEqual({
      provider: "tmdb",
      externalId: "tv:10",
      type: "series",
      title: "Uma Série",
      originalTitle: "A Show",
      overview: "Plot in English.",
      year: 2005,
      posterPath: "/a.jpg",
      runtimeMinutes: 22,
      seasons: [
        { seasonNumber: 0, title: "Especiais", episodeCount: 3 },
        { seasonNumber: 1, title: "Season 1", episodeCount: 22 },
      ],
    });
  });

  it("mapeia o filme sem pôster", () => {
    const movie = movieDetailsSchema.parse({
      id: 77,
      title: "Um Filme",
      original_title: "A Movie",
      overview: "Sinopse.",
      release_date: "2006-06-30",
      poster_path: null,
      runtime: 109,
    });
    expect(mapMovieDetails(movie)).toMatchObject({
      type: "movie",
      externalId: "movie:77",
      year: 2006,
      posterPath: null,
      runtimeMinutes: 109,
      seasons: [],
    });
  });

  it("mapeia os episódios da temporada com reserva em inglês", () => {
    const localized = seasonDetailsSchema.parse({
      episodes: [
        { episode_number: 1, name: "Piloto", overview: "Começo.", runtime: 22 },
        { episode_number: 2, name: "", overview: "" },
      ],
    });
    const english = seasonDetailsSchema.parse({
      episodes: [{ episode_number: 2, name: "Second One", overview: "More.", runtime: 21 }],
    });
    expect(seasonNeedsEnglishFallback(localized)).toBe(true);
    expect(mapSeasonEpisodes(localized, english)).toEqual([
      { episodeNumber: 1, title: "Piloto", overview: "Começo.", runtimeMinutes: 22 },
      { episodeNumber: 2, title: "Second One", overview: "More.", runtimeMinutes: 21 },
    ]);
    expect(mapSeasonEpisodes(seasonDetailsSchema.parse({ episodes: [{ episode_number: 3 }] }))).toEqual([
      { episodeNumber: 3, title: "Episódio 3", overview: "", runtimeMinutes: null },
    ]);
  });

  it("inclui o tipo no id externo, porque série e filme têm numerações independentes no TMDB", () => {
    expect(tmdbExternalId("series", 550)).toBe("tv:550");
    expect(tmdbExternalId("movie", 550)).toBe("movie:550");
    expect(tmdbNumericId("series", "tv:550")).toBe("550");
    expect(tmdbNumericId("movie", "tv:550")).toBeNull();
    expect(tmdbNumericId("series", "tv:550/../../account")).toBeNull();
    expect(tmdbNumericId("series", "550")).toBeNull();
  });
});
