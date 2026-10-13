import { getContainer } from "@/infrastructure/container";
import { TransferScreen, type TransferWork } from "@/ui/transfer/transfer-screen";
import { requireUser } from "../../session";

export default async function TransferPage(props: { searchParams: Promise<{ mediaId?: string }> }) {
  await requireUser();
  const { mediaId } = await props.searchParams;
  const container = getContainer();
  const works: TransferWork[] = [];
  for (const entry of await container.listCatalogWorks()) {
    const episodes = await container.listEpisodesByMedia(entry.id);
    const seasons = new Map<number, TransferWork["seasons"][number]>();
    for (const episode of episodes) {
      const season = seasons.get(episode.seasonNumber) ?? {
        seasonNumber: episode.seasonNumber,
        episodes: [],
      };
      season.episodes.push({
        id: episode.id,
        episodeNumber: episode.episodeNumber,
        title: episode.title,
        ready: episode.status === "READY",
      });
      seasons.set(episode.seasonNumber, season);
    }
    works.push({
      id: entry.id,
      title: entry.title,
      type: entry.type,
      seasons: [...seasons.values()].sort((a, b) => a.seasonNumber - b.seasonNumber),
    });
  }
  const selectedMediaId = works.some((work) => work.id === mediaId) ? (mediaId ?? null) : null;
  return <TransferScreen view={{ works, selectedMediaId }} />;
}
