import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SEED_WORKS } from "@/seed/data";
import { StaticMetadataProvider, staticCatalogSchema } from "./static-metadata-provider";

const catalog: unknown = JSON.parse(readFileSync("fixtures/catalog.json", "utf8"));

describe("catálogo fixo do seed", () => {
  const provider = new StaticMetadataProvider(catalog);
  const { works } = staticCatalogSchema.parse(catalog);

  it("cobre todas as obras do seed, com identificador real do TMDB e pôster", () => {
    expect(works.map((work) => work.slug).sort()).toEqual(SEED_WORKS.map((work) => work.slug).sort());
    for (const work of works) {
      expect(work.externalId).toMatch(work.type === "series" ? /^tv:\d+$/ : /^movie:\d+$/);
      expect(work.posterPath).toMatch(/^\/.+\.(jpg|png)$/);
      expect(work.overview.length).toBeGreaterThan(0);
    }
  });

  it("tem os episódios de cada temporada que o seed usa", async () => {
    for (const seed of SEED_WORKS.filter((work) => work.type === "series")) {
      const work = works.find((candidate) => candidate.slug === seed.slug);
      for (const key of Object.keys(seed.episodes)) {
        const [, season, episode] = key.split("-").map(Number);
        const episodes = await provider.getSeasonEpisodes(work?.externalId ?? "", season ?? 0);
        expect(
          episodes.some((entry) => entry.episodeNumber === episode),
          key,
        ).toBe(true);
      }
    }
  });

  it("busca pelo título original ou traduzido e devolve detalhes sem rede", async () => {
    const [found] = await provider.searchWorks("how i met");
    expect(found).toMatchObject({ provider: "tmdb", type: "series", originalTitle: "How I Met Your Mother" });
    const details = await provider.getWork("series", found?.externalId ?? "");
    expect(details.seasons.length).toBeGreaterThan(1);
    await expect(provider.getWork("movie", found?.externalId ?? "")).rejects.toMatchObject({
      code: "METADATA_NOT_FOUND",
    });
    expect((await provider.listPopularWorks()).length).toBe(works.length);
    expect((await provider.listRelatedWorks("series", found?.externalId ?? "")).length).toBeGreaterThan(0);
  });
});
