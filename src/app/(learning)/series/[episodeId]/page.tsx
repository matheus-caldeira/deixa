import { notFound } from "next/navigation";
import { getContainer } from "@/infrastructure/container";
import { pairOf } from "@/modules/identity";
import { isAppError } from "@/shared/errors";
import { EpisodeTrailScreen } from "@/ui/series/episode-trail-screen";
import { requireUser } from "../../../session";

export default async function PersonalEpisodePage(props: { params: Promise<{ episodeId: string }> }) {
  const user = await requireUser();
  const { episodeId } = await props.params;
  const trail = await getContainer()
    .getPersonalEpisodeTrail({ userId: user.id, pair: pairOf(user.preferences), episodeId })
    .catch((error: unknown) => {
      if (isAppError(error)) notFound();
      throw error;
    });
  return (
    <EpisodeTrailScreen
      view={{
        id: trail.episode.id,
        title: trail.episode.title,
        number: trail.episode.number,
        seasonNumber: trail.season.number,
        seasonLevel: trail.season.level,
        seriesName: trail.seriesName,
        cardCount: trail.episode.cardCount,
        progress: trail.progress,
        nodes: trail.nodes,
        sources: trail.sources.map((source) => ({
          sessionId: source.sessionId,
          themeId: source.themeId,
          themeTitle: source.themeTitle,
          closedAt: source.closedAt?.toISOString() ?? null,
        })),
      }}
    />
  );
}
