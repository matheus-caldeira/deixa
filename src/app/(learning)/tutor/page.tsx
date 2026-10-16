import { getContainer } from "@/infrastructure/container";
import { THEMES } from "@/modules/conversations";
import { pairOf } from "@/modules/identity";
import { TalkScreen } from "@/ui/talk/talk-screen";
import { requireUser } from "../../session";

export default async function TutorPage() {
  const user = await requireUser();
  const container = getContainer();
  const [recent, simulated, learner, series] = await Promise.all([
    container.listConversations(user.id, user.preferences.targetLanguage),
    container.isTutorSimulated(user.id),
    container.getLearnerProfile(user.id, user.preferences.targetLanguage),
    container.getPersonalSeries({
      userId: user.id,
      pair: pairOf(user.preferences),
      userLevel: user.preferences.level,
    }),
  ]);
  const seriesEpisodes = series.seasons.flatMap((season) => season.episodes);
  return (
    <TalkScreen
      simulated={simulated}
      learner={{
        improvements: learner.improvements,
        strengths: learner.strengths,
        mistakes: learner.mistakes,
      }}
      series={{
        name: series.series.name,
        episodes: seriesEpisodes.length,
        cards: seriesEpisodes.reduce((sum, episode) => sum + episode.cardCount, 0),
      }}
      themes={THEMES.map((theme) => ({ id: theme.id, icon: theme.icon }))}
      recent={recent.map((session) => ({
        id: session.id,
        themeId: session.themeId,
        title: session.themeTitle,
        turnCount: session.turnCount,
        closed: session.closedAt !== null,
        reviewStatus: session.reviewStatus,
        score: session.review?.score ?? null,
      }))}
    />
  );
}
