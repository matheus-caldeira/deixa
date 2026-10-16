import { getContainer } from "@/infrastructure/container";
import { pairOf } from "@/modules/identity";
import { SeriesScreen } from "@/ui/series/series-screen";
import { requireUser } from "../../session";

export default async function SeriesPage() {
  const user = await requireUser();
  const view = await getContainer().getPersonalSeries({
    userId: user.id,
    pair: pairOf(user.preferences),
    userLevel: user.preferences.level,
  });
  return (
    <SeriesScreen
      view={{
        id: view.series.id,
        name: view.series.name,
        description: view.series.description,
        descriptionUpdatedAt: view.series.descriptionUpdatedAt?.toISOString() ?? null,
        descriptionBasis: view.series.descriptionBasis,
        level: view.series.level,
        userLevel: user.preferences.level,
        activeLevel: view.activeLevel,
        seasons: view.seasons.map((season) => ({
          id: season.id,
          number: season.number,
          level: season.level,
          episodes: season.episodes.map((episode) => ({
            id: episode.id,
            number: episode.number,
            title: episode.title,
            cardCount: episode.cardCount,
            sourceCount: episode.sourceCount,
            progress: episode.progress,
            fresh: episode.fresh,
          })),
        })),
        upcoming: view.upcoming,
      }}
    />
  );
}
