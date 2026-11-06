import { z } from "zod";
import { backdropUrl, posterColorsFor, posterUrl, stillUrl, type MediaType } from "@/modules/catalog";
import { suggestTheme } from "@/modules/conversations";
import { pairOf } from "@/modules/identity";
import { nextEpisodeId } from "@/modules/personal-series";
import { routes } from "@/shared/routes";
import type { HomeView } from "@/ui/home/home-screen";
import { operation } from "../operation";
import { ensureCurrentPlan } from "./plan";

export const homeViews = {
  "view.home": operation({
    input: z.undefined(),
    run: async (context): Promise<HomeView> => {
      const { user, app, translator } = context;
      const currentId = user.preferences.currentEpisodeId;
      const pair = pairOf(user.preferences);
      const level = user.preferences.level;
      const t = await translator("trail");
      const [summary, dueCount, episode, overview, conversations, personal, dueRecaps] = await Promise.all([
        app.getProfileSummary({
          userId: user.id,
          dailyGoal: user.preferences.dailyGoal,
          timezone: user.preferences.timezone,
        }),
        app.countDueCards(user.id, pair),
        currentId ? app.getEpisodeContext(currentId) : Promise.resolve(null),
        app.getCatalogOverview(user.id),
        app.listConversations(user.id, pair.target),
        app.getPersonalSeries({ userId: user.id, pair, userLevel: level }),
        app.countDueRecaps({ userId: user.id, pair }),
      ]);
      const suggestedTheme = suggestTheme(conversations.map((session) => session.themeId));
      const unfinished = conversations.find((session) => session.review === null && session.turnCount > 1);
      const labelOf = (type: MediaType, season: number, episode: number) =>
        type === "movie" ? t("label.movie") : t("label.episode", { season, episode });

      const ready =
        episode?.episode.status === "READY" && episode.episode.subtitleLanguages.includes(pair.target);
      const label = episode
        ? labelOf(episode.media.type, episode.season.seasonNumber, episode.episode.episodeNumber)
        : "";
      const plan =
        episode && ready
          ? await ensureCurrentPlan(context, {
              userId: user.id,
              episodeId: episode.episode.id,
              pair,
              level,
              episodeLabel: `${episode.media.title} · ${label}`,
            })
          : null;
      const trail =
        plan?.status === "READY" && episode
          ? await app.getTrail(user.id, episode.episode.id, pair, level)
          : null;
      const progress =
        overview.inProgress.find((entry) => entry.episodeId === currentId)?.progressPercent ?? 0;
      const trailHref = (mediaId: string, type: MediaType, season: number) =>
        type === "movie" ? routes.trail(mediaId) : routes.trail(mediaId, season);

      const seen = new Set(episode ? [episode.media.id] : []);
      const others: HomeView["others"] = overview.inProgress.flatMap((entry) => {
        if (seen.has(entry.mediaId)) return [];
        seen.add(entry.mediaId);
        return [
          {
            key: entry.mediaId,
            title: entry.media.title,
            subtitle: `${labelOf(entry.media.type, entry.seasonNumber, entry.episodeNumber)} · ${entry.episodeTitle}`,
            progressPercent: entry.progressPercent,
            href: trailHref(entry.mediaId, entry.media.type, entry.seasonNumber),
            poster: {
              title: entry.media.title,
              type: entry.media.type,
              year: entry.media.year,
              posterUrl: posterUrl(entry.media.posterPath),
              posterColors: entry.media.posterColors,
            },
          },
        ];
      });
      const activeSeason = personal.seasons.find((season) => season.level === personal.activeLevel);
      const nextId = activeSeason ? nextEpisodeId(activeSeason.episodes) : null;
      const nextPersonal = activeSeason?.episodes.find((episode) => episode.id === nextId);
      if (nextPersonal && activeSeason) {
        const name = personal.series.name ?? t("personalName");
        others.unshift({
          key: "personal",
          title: name,
          subtitle: `${t("label.personal", { level: activeSeason.level, episode: nextPersonal.number })} · ${nextPersonal.title}`,
          progressPercent: nextPersonal.progress,
          href: routes.personalTrail(),
          poster: {
            title: name,
            type: "series",
            year: null,
            posterUrl: null,
            posterColors: posterColorsFor(name),
          },
        });
      }

      return {
        current: episode
          ? {
              mediaTitle: episode.media.title,
              label,
              episodeTitle: episode.episode.title,
              progressPercent: trail?.progressPercent ?? progress,
              lessons: trail
                ? {
                    done: trail.nodes.filter((node) => node.state === "done").length,
                    total: trail.nodes.length,
                  }
                : null,
              building: plan?.status === "PENDING",
              trailHref: trailHref(episode.media.id, episode.media.type, episode.season.seasonNumber),
              readHref: episode.episode.status === "READY" ? routes.read(episode.episode.id) : null,
              imageUrl:
                stillUrl(episode.episode.stillPath)?.replace("/w300/", "/w780/") ??
                backdropUrl(episode.media.backdropPath),
            }
          : null,
        xpToday: summary.xpToday,
        dailyGoal: summary.dailyGoal,
        streak: summary.streak,
        dueCount,
        dueRecaps,
        others,
        missions: summary.missions,
        tutor: {
          suggestedThemeId: suggestedTheme.id,
          suggestedIcon: suggestedTheme.icon,
          continueSession: unfinished
            ? { id: unfinished.id, themeId: unfinished.themeId, title: unfinished.themeTitle }
            : null,
        },
      };
    },
  }),
};
