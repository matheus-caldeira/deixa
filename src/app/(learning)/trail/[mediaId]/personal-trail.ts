import { getTranslations } from "next-intl/server";
import { getContainer } from "@/infrastructure/container";
import { posterColorsFor } from "@/modules/catalog";
import { pairOf, type SessionUser } from "@/modules/identity";
import { nextEpisodeId } from "@/modules/personal-series";
import type { WorkTrailView } from "@/ui/trail/work-trail-screen";

const COMPLETE = 100;
const NODE_ICONS = ["quote", "ear", "pen"] as const;

export async function personalTrailView(
  user: SessionUser,
  requested: string | undefined,
): Promise<WorkTrailView> {
  const t = await getTranslations("trail");
  const series = await getContainer().getPersonalSeries({
    userId: user.id,
    pair: pairOf(user.preferences),
    userLevel: user.preferences.level,
  });
  const name = series.series.name ?? t("personalName");
  const active = series.activeLevel;
  const upcoming = series.upcoming;
  const levels = [...series.seasons.map((season) => season.level), ...(upcoming ? [upcoming.level] : [])];
  const selected = levels.find((level) => level === requested) ?? active;
  const season = series.seasons.find((candidate) => candidate.level === selected) ?? null;
  const nextId = season && season.level === active ? nextEpisodeId(season.episodes) : null;

  return {
    kind: "personal",
    title: name,
    poster: { title: name, type: "series", year: null, posterUrl: null, posterColors: posterColorsFor(name) },
    manageHref: "/series",
    seasons: [
      ...series.seasons.map((candidate) => ({
        key: candidate.level,
        label: t("level", { level: candidate.level }),
        done: candidate.episodes.filter((episode) => episode.progress >= COMPLETE).length,
        total: candidate.episodes.length,
        locked: false,
        href: `/trail/personal?season=${candidate.level}`,
        selected: candidate.level === selected,
      })),
      ...(upcoming
        ? [
            {
              key: upcoming.level,
              label: t("level", { level: upcoming.level }),
              done: 0,
              total: 0,
              locked: true,
              href: `/trail/personal?season=${upcoming.level}`,
              selected: upcoming.level === selected,
            },
          ]
        : []),
    ],
    sections: (season?.episodes ?? []).map((episode) => {
      const status =
        episode.progress >= COMPLETE && episode.cardCount > 0
          ? ("done" as const)
          : episode.id === nextId
            ? ("current" as const)
            : ("open" as const);
      return {
        key: episode.id,
        label: t("label.personal", { level: season?.level ?? active, episode: episode.number }),
        title: episode.title,
        overview: "",
        status,
        progressPercent: episode.progress,
        nodes: episode.nodes.map((state, index) => ({
          index,
          state,
          icon: NODE_ICONS[index % NODE_ICONS.length] ?? "quote",
          title: "",
          href: state === "locked" ? null : `/series/${episode.id}/lesson/${index}`,
        })),
        startEpisodeId: null,
        conversation: null,
        detail: { href: `/series/${episode.id}`, kind: "cards" as const },
      };
    }),
    lockedSeason:
      upcoming && upcoming.level === selected
        ? { level: upcoming.level, unlockAt: upcoming.unlockAt, themes: upcoming.themes }
        : null,
    currentHref: selected !== active ? `/trail/personal?season=${active}` : null,
    failure: null,
  };
}
