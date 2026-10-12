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
        backdrop_path: text,
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
  backdrop_path: text,
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
        still_path: text,
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
  backdrop_path: text,
  runtime: z.number().nullish(),
});

export const workListSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.number(),
        name: text,
        title: text,
        original_name: text,
        original_title: text,
        overview: text,
        first_air_date: text,
        release_date: text,
        poster_path: text,
        backdrop_path: text,
        genre_ids: z.array(z.number()).nullish(),
        original_language: text,
        popularity: z.number().nullish(),
      }),
    )
    .default([]),
});

export const genreListSchema = z.object({
  genres: z.array(z.object({ id: z.number(), name: z.string() })).default([]),
});

export type TmdbWorkList = z.infer<typeof workListSchema>;
export type TmdbSearchMulti = z.infer<typeof searchMultiSchema>;
export type TmdbTvDetails = z.infer<typeof tvDetailsSchema>;
export type TmdbSeasonDetails = z.infer<typeof seasonDetailsSchema>;
export type TmdbMovieDetails = z.infer<typeof movieDetailsSchema>;
