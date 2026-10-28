import { EpisodeTrailScreen } from "@/ui/series/episode-trail-screen";
import { loadView } from "@/app/views";

export default async function Page(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <EpisodeTrailScreen {...await loadView("view.seriesEpisode", await props.searchParams)} />;
}
