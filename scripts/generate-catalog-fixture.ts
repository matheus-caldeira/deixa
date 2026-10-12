import { writeFile } from "node:fs/promises";
import { getEnv, hasTmdbCredentials } from "@/infrastructure/config/env";
import { TmdbClient } from "@/infrastructure/tmdb/client";
import { TmdbMetadataProvider } from "@/infrastructure/tmdb/tmdb-metadata-provider";
import { demoWorkNotes } from "@/modules/catalog/infrastructure/fake-metadata-provider";
import {
  staticCatalogSchema,
  type StaticCatalog,
} from "@/modules/catalog/infrastructure/static-metadata-provider";
import { SEED_WORKS } from "@/seed/data";

const OUTPUT = "fixtures/catalog.json";

async function main(): Promise<void> {
  const env = getEnv();
  if (!hasTmdbCredentials(env)) throw new Error("credenciais do TMDB ausentes no .env");
  const provider = new TmdbMetadataProvider(
    new TmdbClient({ readAccessToken: env.TMDB_READ_ACCESS_TOKEN, apiKey: env.TMDB_API_KEY }),
  );
  const works: StaticCatalog["works"] = [];
  for (const work of SEED_WORKS) {
    const found = (await provider.searchWorks(work.title)).filter((item) => item.type === work.type);
    const match =
      found.find((item) => item.originalTitle === work.title && item.year === work.year) ??
      found.find((item) => item.year === work.year);
    if (!match) throw new Error(`obra não encontrada no TMDB: ${work.title}`);
    const details = await provider.getWork(work.type, match.externalId);
    const wanted = new Set(Object.keys(work.episodes).map((key) => Number(key.split("-")[1])));
    const seasons: StaticCatalog["works"][number]["seasons"] = [];
    for (const season of details.seasons) {
      const episodes =
        work.type === "series" && wanted.has(season.seasonNumber)
          ? await provider.getSeasonEpisodes(match.externalId, season.seasonNumber)
          : [];
      seasons.push({
        seasonNumber: season.seasonNumber,
        title: `Temporada ${season.seasonNumber}`,
        episodeCount: season.episodeCount,
        episodes: episodes.map((episode) => ({
          episodeNumber: episode.episodeNumber,
          title: episode.title,
          runtimeMinutes: episode.runtimeMinutes,
          stillPath: episode.stillPath ?? null,
        })),
      });
    }
    const notes = demoWorkNotes(work.title);
    works.push({
      slug: work.slug,
      externalId: details.externalId,
      type: details.type,
      title: details.title,
      originalTitle: details.originalTitle,
      overview: notes?.overview ?? "",
      genres: notes?.genres ?? [],
      year: details.year,
      posterPath: details.posterPath,
      backdropPath: details.backdropPath ?? null,
      runtimeMinutes: details.runtimeMinutes,
      seasons,
    });
    console.info(`catálogo: ${work.title} → ${details.externalId}`);
  }
  const catalog = staticCatalogSchema.parse({ source: "tmdb", works });
  await writeFile(OUTPUT, `${JSON.stringify(catalog, null, 2)}\n`);
  console.info(`catálogo fixo gravado em ${OUTPUT}: ${works.length} obras`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "falha ao gerar o catálogo fixo");
  process.exit(1);
});
