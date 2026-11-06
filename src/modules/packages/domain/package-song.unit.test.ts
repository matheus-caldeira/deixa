import { describe, expect, it } from "vitest";
import { packagedCatalogSchema } from "./package";

const episode = {
  seasonNumber: 1,
  episodeNumber: 1,
  title: "Faixa",
  overview: "",
  durationSeconds: 52,
  stillPath: null,
  subtitles: [],
  cardsPath: null,
};

const work = (type: string, extra: object = {}) => ({
  workKey: "manual:playlist:x",
  metadataProvider: "manual",
  externalId: "playlist:x",
  type,
  title: "Minhas músicas",
  originalTitle: "Minhas músicas",
  overview: "",
  year: null,
  posterPath: null,
  backdropPath: null,
  posterColors: { c1: "#000", c2: "#111", fg: "#fff" },
  levelMin: "B1",
  levelMax: "B2",
  accent: null,
  seasons: [{ seasonNumber: 1, title: "Músicas", episodeCount: null }],
  episodes: [{ ...episode, ...extra }],
});

describe("pacote com música", () => {
  it("continua lendo obras antigas, sem faixa", () => {
    expect(packagedCatalogSchema.safeParse({ works: [work("series")] }).success).toBe(true);
  });

  it("lê a obra de música com a faixa do episódio", () => {
    const song = {
      youtubeVideoId: "dQw4w9WgXcQ",
      artist: "Artista fictício",
      trackTitle: "Faixa",
      durationMs: 52_000,
      leadInMs: 8000,
      pauses: [{ atMs: 30_000, durationMs: 2000 }],
      lyricsSource: "fake",
      lyricsExternalId: "fake-1",
      translationSource: "llm",
    };
    const parsed = packagedCatalogSchema.safeParse({ works: [work("music", { song })] });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.works[0]?.episodes[0]?.song?.leadInMs).toBe(8000);
  });

  it("recusa faixa com id de vídeo inválido", () => {
    const song = { youtubeVideoId: "curto" };
    expect(packagedCatalogSchema.safeParse({ works: [work("music", { song })] }).success).toBe(false);
  });
});
