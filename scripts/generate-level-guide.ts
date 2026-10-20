import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { getEnv, hasTmdbCredentials } from "@/infrastructure/config/env";
import { TmdbClient } from "@/infrastructure/tmdb/client";
import { CEFR_LEVELS } from "@/shared/levels";
import { STUDY_LANGUAGES } from "@/shared/study-languages";
import { LEVEL_GUIDE_TITLES, LEVEL_TRAITS, type LevelGuideTitle } from "./level-guide-titles";

const OUTPUT = "fixtures/level-guide.json";
const PORTUGUESE = "pt-BR";
const TMDB_KIND = { series: "tv", movie: "movie" } as const;
const YEAR_PARAM = { series: "first_air_date_year", movie: "primary_release_year" } as const;
const TMDB_LANGUAGE = { en: "en", "pt-BR": "pt", es: "es", fr: "fr" } as const;
const YEAR_TOLERANCE = 1;

const text = z.string().nullish();
const searchSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.number(),
        name: text,
        title: text,
        original_name: text,
        original_title: text,
        first_air_date: text,
        release_date: text,
        poster_path: text,
        genre_ids: z.array(z.number()).nullish(),
        original_language: text,
        popularity: z.number().nullish(),
        vote_average: z.number().nullish(),
        vote_count: z.number().nullish(),
      }),
    )
    .default([]),
});
const genreListSchema = z.object({
  genres: z.array(z.object({ id: z.number(), name: z.string() })).default([]),
});

type Result = z.infer<typeof searchSchema>["results"][number];

const normalize = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const yearOf = (result: Result) => Number((result.first_air_date || result.release_date || "").slice(0, 4));

function pick(work: LevelGuideTitle, results: Result[]): Result | null {
  if (work.tmdbId) return results.find((result) => result.id === work.tmdbId) ?? null;
  const wanted = normalize(work.title);
  const sameLanguage = results.filter((result) => result.original_language === TMDB_LANGUAGE[work.language]);
  const named = sameLanguage.filter((result) =>
    [result.original_name, result.original_title, result.name, result.title].some(
      (name) => normalize(name) === wanted,
    ),
  );
  const near = (list: Result[]) =>
    list.find((result) => yearOf(result) === work.year) ??
    list.find((result) => Math.abs(yearOf(result) - work.year) <= YEAR_TOLERANCE);
  return near(named) ?? named[0] ?? near(sameLanguage) ?? null;
}

function toWork(work: LevelGuideTitle, found: Result, genres: ReadonlyMap<string, string>) {
  const kind = TMDB_KIND[work.type];
  return {
    tmdbId: found.id,
    type: work.type,
    language: work.language,
    title: found.name || found.title || work.title,
    originalTitle: found.original_name || found.original_title || work.title,
    year: yearOf(found) || work.year,
    level: work.level,
    levelMin: work.level,
    levelMax: work.levelMax,
    traits: work.traits,
    voteAverage: Math.round((found.vote_average ?? 0) * 10) / 10,
    voteCount: found.vote_count ?? 0,
    popularity: Math.round((found.popularity ?? 0) * 10) / 10,
    genres: (found.genre_ids ?? []).flatMap((id) => genres.get(`${kind}:${id}`) ?? []),
    posterPath: found.poster_path ?? null,
  };
}

type LevelGuideWork = ReturnType<typeof toWork>;

async function main(): Promise<void> {
  const env = getEnv();
  if (!hasTmdbCredentials(env)) throw new Error("credenciais do TMDB ausentes no .env");
  const client = new TmdbClient({ readAccessToken: env.TMDB_READ_ACCESS_TOKEN, apiKey: env.TMDB_API_KEY });
  const genres = new Map<string, string>();
  for (const kind of Object.values(TMDB_KIND)) {
    const list = await client.get(`genre/${kind}/list`, { language: PORTUGUESE }, genreListSchema);
    for (const genre of list.genres) genres.set(`${kind}:${genre.id}`, genre.name);
  }

  const search = async (work: LevelGuideTitle, withYear: boolean) => {
    const params: Record<string, string> = {
      query: work.title,
      language: PORTUGUESE,
      include_adult: "false",
    };
    if (withYear) params[YEAR_PARAM[work.type]] = String(work.year);
    return (await client.get(`search/${TMDB_KIND[work.type]}`, params, searchSchema)).results;
  };

  const works: LevelGuideWork[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const work of LEVEL_GUIDE_TITLES) {
    const found = pick(work, await search(work, true)) ?? pick(work, await search(work, false));
    if (!found) {
      missing.push(`${work.title} (${work.type}, ${work.year})`);
      continue;
    }
    const key = `${work.type}:${found.id}`;
    if (seen.has(key)) {
      missing.push(`${work.title} (${work.type}, ${work.year}) repetida como ${found.id}`);
      continue;
    }
    seen.add(key);
    works.push(toWork(work, found, genres));
    console.info(`${work.level} ${work.title} → ${found.id}`);
  }

  const count = (keys: readonly string[], of: (work: (typeof works)[number]) => string) =>
    Object.fromEntries(keys.map((key) => [key, works.filter((work) => of(work) === key).length]));
  const guide = {
    source: "tmdb",
    attribution: "This product uses the TMDB API but is not endorsed or certified by TMDB.",
    levels: CEFR_LEVELS,
    traits: LEVEL_TRAITS,
    counts: {
      total: works.length,
      byLevel: count(CEFR_LEVELS, (work) => work.level),
      byLanguage: count(STUDY_LANGUAGES, (work) => work.language),
      englishByLevel: count(CEFR_LEVELS, (work) => (work.language === "en" ? work.level : "none")),
    },
    works: works.sort(
      (a, b) =>
        CEFR_LEVELS.indexOf(a.level) - CEFR_LEVELS.indexOf(b.level) ||
        STUDY_LANGUAGES.indexOf(a.language) - STUDY_LANGUAGES.indexOf(b.language) ||
        b.voteCount - a.voteCount,
    ),
  };
  await writeFile(OUTPUT, `${JSON.stringify(guide, null, 2)}\n`);
  console.info(`guia de níveis gravado em ${OUTPUT}: ${works.length} obras`);
  if (missing.length > 0) console.info(`não encontradas: ${missing.join("; ")}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "falha ao gerar o guia de níveis");
  process.exit(1);
});
