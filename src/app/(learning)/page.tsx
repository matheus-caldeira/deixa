import { getTranslations } from "next-intl/server";
import { getContainer } from "@/infrastructure/container";
import { backdropUrl, episodeLabel, stillUrl } from "@/modules/catalog";
import { pairOf } from "@/modules/identity";
import { isAppError } from "@/shared/errors";
import { formatTimecode } from "@/shared/time";
import { HomeScreen } from "@/ui/home/home-screen";
import { scheduleJob } from "../schedule";
import { requireUser } from "../session";

export default async function HomePage() {
  const user = await requireUser();
  const container = getContainer();
  const currentId = user.preferences.currentEpisodeId;
  const pair = pairOf(user.preferences);
  const [summary, dueCount, context, overview] = await Promise.all([
    container.getProfileSummary({
      userId: user.id,
      dailyGoal: user.preferences.dailyGoal,
      timezone: user.preferences.timezone,
    }),
    container.countDueCards(user.id, pair),
    currentId ? container.getEpisodeContext(currentId) : Promise.resolve(null),
    container.getCatalogOverview(user.id),
  ]);
  const script =
    context?.episode.status === "READY" ? await container.getEpisodeScript(context.episode.id, pair) : null;
  const label = context
    ? episodeLabel(context.media.type, context.season.seasonNumber, context.episode.episodeNumber)
    : "";
  const planStatus =
    script && context
      ? await container
          .ensurePlan({
            userId: user.id,
            episodeId: context.episode.id,
            pair,
            level: user.preferences.level,
            episodeLabel: `${context.media.title} · ${label}`,
          })
          .catch((error: unknown) => {
            if (isAppError(error)) return { status: "FAILED" as const, reason: error.code };
            throw error;
          })
      : null;
  if (planStatus?.status === "PENDING" && planStatus.job) {
    await scheduleJob(container, "generate_plan", planStatus.job, user.id);
  }
  const trail =
    planStatus?.status === "READY" && context
      ? await container.getTrail(user.id, context.episode.id, pair, user.preferences.level)
      : null;
  const progress = overview.inProgress.find((entry) => entry.episodeId === currentId)?.progressPercent ?? 0;
  const t = await getTranslations("home");

  return (
    <HomeScreen
      view={{
        level: user.preferences.level,
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
          nm: node.title || t(node.isFinal ? "finalChallenge" : "sceneTitle", { number: node.index + 1 }),
          ic: node.icon,
          state: node.state,
        })),
        studyHref:
          trail && context
            ? `/study/${context.episode.id}/${trail.currentIndex ?? Math.max(0, trail.nodes.length - 1)}`
            : null,
        trailStatus:
          planStatus?.status === "PENDING" ? "pending" : planStatus?.status === "FAILED" ? "failed" : "ready",
        trailByAi: trail?.generatedByAi ?? false,
        trailFailure: planStatus?.status === "FAILED" ? planStatus.reason : null,
        missions: summary.missions,
      }}
    />
  );
}
