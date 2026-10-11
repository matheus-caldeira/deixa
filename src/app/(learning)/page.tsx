import { getContainer } from "@/infrastructure/container";
import { backdropUrl, episodeLabel, stillUrl } from "@/modules/catalog";
import { LEVEL_NAMES } from "@/shared/levels";
import { formatTimecode } from "@/shared/time";
import { HomeScreen } from "@/ui/home/home-screen";
import { requireUser } from "../session";

export default async function HomePage() {
  const user = await requireUser();
  const container = getContainer();
  const currentId = user.preferences.currentEpisodeId;
  const [summary, dueCount, context, overview] = await Promise.all([
    container.getProfileSummary({
      userId: user.id,
      dailyGoal: user.preferences.dailyGoal,
      timezone: user.preferences.timezone,
    }),
    container.countDueCards(user.id),
    currentId ? container.getEpisodeContext(currentId) : Promise.resolve(null),
    container.getCatalogOverview(user.id),
  ]);
  const script =
    context?.episode.status === "READY" ? await container.getEpisodeScript(context.episode.id) : null;
  const trail = script ? await container.getTrail(user.id, context?.episode.id ?? "") : null;
  const progress = overview.inProgress.find((entry) => entry.episodeId === currentId)?.progressPercent ?? 0;

  return (
    <HomeScreen
      view={{
        level: user.preferences.level,
        levelName: LEVEL_NAMES[user.preferences.level],
        current: context
          ? {
              episodeId: context.episode.id,
              mediaTitle: context.media.title,
              label: episodeLabel(
                context.media.type,
                context.season.seasonNumber,
                context.episode.episodeNumber,
              ),
              episodeTitle: context.episode.title,
              line: script?.lines[0]?.text ?? "",
              progressPercent: progress,
              ready: context.episode.status === "READY",
              imageUrl:
                stillUrl(context.episode.stillPath)?.replace("/w300/", "/w780/") ??
                backdropUrl(context.media.backdropPath),
            }
          : null,
        xpToday: summary.xpToday,
        dailyGoal: summary.dailyGoal,
        streak: summary.streak,
        dueCount,
        trail: (trail?.nodes ?? []).map((node) => ({
          index: node.index,
          tc: formatTimecode(node.startMs),
          nm: node.title,
          ic: node.icon,
          state: node.state,
        })),
        studyHref:
          trail && context
            ? `/study/${context.episode.id}/${trail.currentIndex ?? Math.max(0, trail.nodes.length - 1)}`
            : null,
        missions: summary.missions,
      }}
    />
  );
}
