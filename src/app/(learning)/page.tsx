import { getTranslations } from "next-intl/server";
import { getContainer } from "@/infrastructure/container";
import { backdropUrl, posterColorsFor, posterUrl, stillUrl } from "@/modules/catalog";
import { pairOf } from "@/modules/identity";
import { nextEpisodeId } from "@/modules/personal-series";
import { suggestTheme } from "@/modules/conversations";
import { HomeScreen, type HomeView } from "@/ui/home/home-screen";
import { requireUser } from "../session";
import { ensureCurrentPlan } from "./current-plan";
import { routes } from "@/shared/routes";

export default async function HomePage() {
  const user = await requireUser();
  const container = getContainer();
  const currentId = user.preferences.currentEpisodeId;
  const pair = pairOf(user.preferences);
  const level = user.preferences.level;
  const t = await getTranslations("trail");
  const [summary, dueCount, context, overview, conversations, personal, dueRecaps] = await Promise.all([
    container.getProfileSummary({
      userId: user.id,
      dailyGoal: user.preferences.dailyGoal,
      timezone: user.preferences.timezone,
    }),
    container.countDueCards(user.id, pair),
    currentId ? container.getEpisodeContext(currentId) : Promise.resolve(null),
    container.getCatalogOverview(user.id),
    container.listConversations(user.id, pair.target),
    container.getPersonalSeries({ userId: user.id, pair, userLevel: level }),
    container.countDueRecaps({ userId: user.id, pair }),
  ]);
  const suggestedTheme = suggestTheme(conversations.map((session) => session.themeId));
  const unfinished = conversations.find((session) => session.review === null && session.turnCount > 1);
  const labelOf = (type: "series" | "movie", season: number, episode: number) =>
    type === "movie" ? t("label.movie") : t("label.episode", { season, episode });

  const ready =
    context?.episode.status === "READY" && context.episode.subtitleLanguages.includes(pair.target);
  const label = context
    ? labelOf(context.media.type, context.season.seasonNumber, context.episode.episodeNumber)
    : "";
  const plan =
    context && ready
      ? await ensureCurrentPlan(container, {
          userId: user.id,
          episodeId: context.episode.id,
          pair,
          level,
          episodeLabel: `${context.media.title} · ${label}`,
        })
      : null;
  const trail =
    plan?.status === "READY" && context
      ? await container.getTrail(user.id, context.episode.id, pair, level)
      : null;
  const progress = overview.inProgress.find((entry) => entry.episodeId === currentId)?.progressPercent ?? 0;
  const trailHref = (mediaId: string, type: "series" | "movie", season: number) =>
    type === "movie" ? routes.trail(mediaId) : routes.trail(mediaId, season);

  const seen = new Set(context ? [context.media.id] : []);
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

  return (
    <HomeScreen
      view={{
        current: context
          ? {
              mediaTitle: context.media.title,
              label,
              episodeTitle: context.episode.title,
              progressPercent: trail?.progressPercent ?? progress,
              lessons: trail
                ? {
                    done: trail.nodes.filter((node) => node.state === "done").length,
                    total: trail.nodes.length,
                  }
                : null,
              building: plan?.status === "PENDING",
              trailHref: trailHref(context.media.id, context.media.type, context.season.seasonNumber),
              readHref: context.episode.status === "READY" ? routes.read(context.episode.id) : null,
              imageUrl:
                stillUrl(context.episode.stillPath)?.replace("/w300/", "/w780/") ??
                backdropUrl(context.media.backdropPath),
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
      }}
    />
  );
}
