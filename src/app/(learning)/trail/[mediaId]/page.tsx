import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { getContainer } from "@/infrastructure/container";
import { logger } from "@/infrastructure/logger/logger";
import { posterUrl } from "@/modules/catalog";
import { pairOf } from "@/modules/identity";
import { isAppError } from "@/shared/errors";
import { WorkTrailScreen } from "@/ui/trail/work-trail-screen";
import { requireUser } from "../../../session";
import { ensureCurrentPlan } from "../../current-plan";
import { personalTrailView } from "./personal-trail";

const COMPLETE = 100;

export default async function TrailPage(props: {
  params: Promise<{ mediaId: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const user = await requireUser();
  const { mediaId } = await props.params;
  const { season } = await props.searchParams;
  if (mediaId === "personal") return <WorkTrailScreen view={await personalTrailView(user, season)} />;
  if (!z.uuid().safeParse(mediaId).success) notFound();

  const container = getContainer();
  const pair = pairOf(user.preferences);
  const level = user.preferences.level;
  const t = await getTranslations("trail");
  const detail = await container.getMediaDetail(user.id, mediaId).catch((error: unknown) => {
    if (isAppError(error) && error.code === "MEDIA_NOT_FOUND") notFound();
    throw error;
  });
  const { media } = detail;
  const isMovie = media.type === "movie";
  const allSeasons = (await container.listSeasons(mediaId)).filter(
    (entry) => isMovie || entry.seasonNumber >= 1,
  );
  const currentId = user.preferences.currentEpisodeId;
  const currentContext = currentId ? await container.getEpisodeContext(currentId) : null;
  const currentSeason =
    currentContext && currentContext.media.id === mediaId ? currentContext.season.seasonNumber : null;
  const requested = Number(season);
  const seasonNumber = allSeasons.some((entry) => entry.seasonNumber === requested)
    ? requested
    : (currentSeason ?? detail.seasons[0]?.seasonNumber ?? allSeasons[0]?.seasonNumber ?? null);

  let episodes = detail.seasons.find((entry) => entry.seasonNumber === seasonNumber)?.episodes ?? [];
  if (episodes.length === 0 && seasonNumber !== null) {
    const loaded = await container
      .loadSeasonEpisodes({ userId: user.id, mediaId, seasonNumber })
      .catch((error: unknown) => {
        logger.warn("trail.season_load_failed", {
          reason: error instanceof Error ? error.message : "unknown",
        });
        return null;
      });
    episodes = (loaded?.episodes ?? []).map((episode) => ({ ...episode, progressPercent: null }));
  }

  const labelOf = (episodeNumber: number) =>
    isMovie ? t("label.movie") : t("label.episode", { season: seasonNumber ?? 0, episode: episodeNumber });
  const current = episodes.find((episode) => episode.id === currentId) ?? null;
  const plan =
    current && current.status === "READY" && current.subtitleLanguages.includes(pair.target)
      ? await ensureCurrentPlan(container, {
          userId: user.id,
          episodeId: current.id,
          pair,
          level,
          episodeLabel: `${media.title} · ${labelOf(current.episodeNumber)}`,
        })
      : null;
  const sections = await container.getWorkTrail({
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
  const catalogHref = `/catalog/${mediaId}${seasonNumber !== null && !isMovie ? `?season=${seasonNumber}` : ""}`;

  return (
    <WorkTrailScreen
      view={{
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
                done: (loaded?.episodes ?? []).filter((episode) => (episode.progressPercent ?? 0) >= COMPLETE)
                  .length,
                total: entry.episodeCount ?? loaded?.episodes.length ?? 0,
                locked: false,
                href: `/trail/${mediaId}?season=${entry.seasonNumber}`,
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
            href: section.placeholder ? null : `/study/${section.episodeId}/${node.index}`,
          })),
          startEpisodeId: section.status === "open" ? section.episodeId : null,
          conversation: section.status === "missing" ? null : { episodeId: section.episodeId },
          detail:
            section.status === "missing"
              ? { href: catalogHref, kind: "read" }
              : { href: `/read/${section.episodeId}`, kind: "read" },
        })),
        lockedSeason: null,
        failure: current && plan?.status === "FAILED" ? { episodeId: current.id, reason: plan.reason } : null,
        currentHref:
          currentSeason !== null && currentSeason !== seasonNumber
            ? `/trail/${mediaId}?season=${currentSeason}`
            : null,
      }}
    />
  );
}
