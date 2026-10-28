import { TmdbBrowseScreen } from "@/ui/catalog/tmdb-browse-screen";
import { loadView } from "@/app/views";

export default async function Page(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <TmdbBrowseScreen {...await loadView("view.tmdb", await props.searchParams)} />;
}
