import { z } from "zod";

const text = z.string().nullish();

export const searchMultiSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.number(),
        media_type: z.string().nullish(),
        name: text,
        title: text,
        original_name: text,
        original_title: text,
        overview: text,
        first_air_date: text,
        release_date: text,
        poster_path: text,
      }),
    )
    .default([]),
});

export const tvDetailsSchema = z.object({
  id: z.number(),
  name: text,
  original_name: text,
  overview: text,
  first_air_date: text,
  poster_path: text,
  episode_run_time: z.array(z.number()).nullish(),
  seasons: z
    .array(
      z.object({
        season_number: z.number(),
        name: text,
        episode_count: z.number().nullish(),
      }),
    )
    .default([]),
});

export const seasonDetailsSchema = z.object({
  episodes: z
    .array(
      z.object({
        episode_number: z.number(),
        name: text,
        overview: text,
        runtime: z.number().nullish(),
      }),
    )
    .default([]),
});

export const movieDetailsSchema = z.object({
  id: z.number(),
  title: text,
  original_title: text,
  overview: text,
  release_date: text,
  poster_path: text,
  runtime: z.number().nullish(),
});

export type TmdbSearchMulti = z.infer<typeof searchMultiSchema>;
export type TmdbTvDetails = z.infer<typeof tvDetailsSchema>;
export type TmdbSeasonDetails = z.infer<typeof seasonDetailsSchema>;
export type TmdbMovieDetails = z.infer<typeof movieDetailsSchema>;
