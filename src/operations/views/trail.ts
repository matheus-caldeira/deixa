import { z } from "zod";
import type { ComponentProps } from "react";
import { posterUrl } from "@/modules/catalog";
import { pairOf } from "@/modules/identity";
import { AppError, isAppError } from "@/shared/errors";
import { personalTrailView } from "./personal-trail";
import { routes } from "@/shared/routes";
import { ensureCurrentPlan } from "./plan";
import { operation } from "../operation";
import type { WorkTrailScreen } from "@/ui/trail/work-trail-screen";

const COMPLETE = 100;

export const trailView = {
  "view.trail": operation({
    input: z.object({ id: z.string().optional(), season: z.string().optional() }),
    run: async (operationContext, input): Promise<ComponentProps<typeof WorkTrailScreen>> => {
      const { user, app, translator } = operationContext;

      const { id: mediaId = "", season } = input;
      if (mediaId === "personal") return { view: await personalTrailView(operationContext, season) };
      if (!z.uuid().safeParse(mediaId).success) throw new AppError("MEDIA_NOT_FOUND");

      const pair = pairOf(user.preferences);
      const level = user.preferences.level;
      const t = await translator("trail");
      const detail = await app.getMediaDetail(user.id, mediaId).catch((error: unknown) => {
        if (isAppError(error) && error.code === "MEDIA_NOT_FOUND") throw new AppError("MEDIA_NOT_FOUND");
        throw error;
      });
      const { media } = detail;
      const isMovie = media.type === "movie";
      const allSeasons = (await app.listSeasons(mediaId)).filter(
        (entry) => isMovie || entry.seasonNumber >= 1,
      );
      const currentId = user.preferences.currentEpisodeId;
      const currentContext = currentId ? await app.getEpisodeContext(currentId) : null;
      const currentSeason =
        currentContext && currentContext.media.id === mediaId ? currentContext.season.seasonNumber : null;
      const requested = Number(season);
      const seasonNumber = allSeasons.some((entry) => entry.seasonNumber === requested)
        ? requested
        : (currentSeason ?? detail.seasons[0]?.seasonNumber ?? allSeasons[0]?.seasonNumber ?? null);

      let episodes = detail.seasons.find((entry) => entry.seasonNumber === seasonNumber)?.episodes ?? [];
      if (episodes.length === 0 && seasonNumber !== null) {
        const loaded = await app
          .loadSeasonEpisodes({ userId: user.id, mediaId, seasonNumber })
          .catch((error: unknown) => {
            if (isAppError(error)) return null;
            throw error;
          });
        episodes = (loaded?.episodes ?? []).map((episode) => ({ ...episode, progressPercent: null }));
      }

      const labelOf = (episodeNumber: number) =>
        isMovie
          ? t("label.movie")
          : t("label.episode", { season: seasonNumber ?? 0, episode: episodeNumber });
      const current = episodes.find((episode) => episode.id === currentId) ?? null;
      const plan =
        current && current.status === "READY" && current.subtitleLanguages.includes(pair.target)
          ? await ensureCurrentPlan(operationContext, {
              userId: user.id,
              episodeId: current.id,
              pair,
              level,
              episodeLabel: `${media.title} · ${labelOf(current.episodeNumber)}`,
            })
          : null;
      const sections = await app.getWorkTrail({
        userId: user.id,
        pair,
        level,
        currentEpisodeId: currentId,
        episodes: episodes.map((episode) => ({
          id: episode.id,
          number: episode.episodeNumber,
          title: episode.title,
          overview: episode.overview,
          ready: episode.status === "READY" && episode.subtitleLanguages.includes(pair.target),
          progressPercent: episode.progressPercent,
        })),
      });
      const catalogHref = routes.work(mediaId, isMovie ? null : seasonNumber);

      return {
        view: {
          kind: isMovie ? "movie" : "series",
          title: media.title,
          poster: {
            title: media.title,
            type: media.type,
            year: media.year,
            posterUrl: posterUrl(media.posterPath),
            posterColors: media.posterColors,
          },
          manageHref: catalogHref,
          seasons: isMovie
            ? []
            : allSeasons.map((entry) => {
                const loaded = detail.seasons.find(
                  (candidate) => candidate.seasonNumber === entry.seasonNumber,
                );
                return {
                  key: String(entry.seasonNumber),
                  label: t("season", { number: entry.seasonNumber }),
                  done: (loaded?.episodes ?? []).filter(
                    (episode) => (episode.progressPercent ?? 0) >= COMPLETE,
                  ).length,
                  total: entry.episodeCount ?? loaded?.episodes.length ?? 0,
                  locked: false,
                  href: routes.trail(mediaId, entry.seasonNumber),
                  selected: entry.seasonNumber === seasonNumber,
                };
              }),
          sections: sections.map((section) => ({
            key: section.episodeId,
            label: labelOf(section.number),
            title: section.title || labelOf(section.number),
            overview: section.overview,
            status: section.status,
            progressPercent: section.progressPercent,
            nodes: section.nodes.map((node) => ({
              index: node.index,
              state: node.state,
              icon: node.icon,
              title: node.title,
              href: section.placeholder ? null : routes.study(section.episodeId, node.index),
            })),
            startEpisodeId: section.status === "open" ? section.episodeId : null,
            conversation: section.status === "missing" ? null : { episodeId: section.episodeId },
            detail:
              section.status === "missing"
                ? { href: catalogHref, kind: "read" }
                : { href: routes.read(section.episodeId), kind: "read" },
          })),
          lockedSeason: null,
          failure:
            current && plan?.status === "FAILED" ? { episodeId: current.id, reason: plan.reason } : null,
          currentHref:
            currentSeason !== null && currentSeason !== seasonNumber
              ? routes.trail(mediaId, currentSeason)
              : null,
        },
      };
    },
  }),
};
