import { z } from "zod";
import type { ComponentProps } from "react";
import { DISCOVER_SORTS, posterColorsFor, posterUrl, type BrowsePage } from "@/modules/catalog";
import { pairOf } from "@/modules/identity";
import { logger } from "@/infrastructure/logger/logger";
import { fitFor } from "@/shared/levels";
import { STUDY_LANGUAGES } from "@/shared/study-languages";
import type { TmdbBrowseFilters } from "@/ui/catalog/tmdb-browse-screen";
import { operation } from "../operation";
import type { TmdbBrowseScreen } from "@/ui/catalog/tmdb-browse-screen";

const MAX_PAGE = 500;
const MAX_QUERY = 100;

export const tmdbView = {
  "view.tmdb": operation({
    input: z.object({
      q: z.string().optional(),
      type: z.string().optional(),
      lang: z.string().optional(),
      sort: z.string().optional(),
      page: z.string().optional(),
    }),
    run: async (operationContext, input): Promise<ComponentProps<typeof TmdbBrowseScreen>> => {
      const { user, app } = operationContext;

      const params = input;
      const pair = pairOf(user.preferences);
      const filters: TmdbBrowseFilters = {
        query: (params.q ?? "").slice(0, MAX_QUERY),
        type: params.type === "movie" ? "movie" : "series",
        language:
          params.lang === "all"
            ? "all"
            : (STUDY_LANGUAGES.find((language) => language === params.lang) ?? pair.target),
        sort: DISCOVER_SORTS.find((sort) => sort === params.sort) ?? "popular",
        page: Math.min(Math.max(1, Math.trunc(Number(params.page) || 1)), MAX_PAGE),
      };
      let result: BrowsePage | null = null;
      try {
        result = await app.browseWorks(user.id, {
          query: filters.query,
          type: filters.type,
          language: filters.language === "all" ? null : filters.language,
          sort: filters.sort,
          page: filters.page,
        });
      } catch (error) {
        logger.warn("catalog.browse_failed", { reason: error instanceof Error ? error.message : "unknown" });
      }

      return {
        filters,
        canRate: user.isAdmin,
        failed: result === null,
        page: result?.page ?? filters.page,
        totalPages: result?.totalPages ?? 1,
        searching: result?.searching ?? false,
        works: (result?.works ?? []).map((work) => {
          const levelRange = work.range ? `${work.range[0]}–${work.range[1]}` : null;
          return {
            externalId: work.externalId,
            catalogMediaId: work.catalogMediaId,
            poster: {
              title: work.title,
              type: work.type,
              year: work.year,
              posterUrl: posterUrl(work.posterPath),
              posterColors: work.posterColors ?? posterColorsFor(work.title),
              ...(levelRange ? { levelRange } : {}),
            },
            voteAverage: work.voteAverage,
            levelRange,
            fit: work.range ? fitFor(user.preferences.level, work.range[0], work.range[1]) : null,
            ratings: work.ratings.length,
            hasAi: work.ratings.some((rating) => rating.kind === "ai"),
            aiReason: work.aiReason,
          };
        }),
      };
    },
  }),
};
