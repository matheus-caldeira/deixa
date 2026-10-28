import { SeriesScreen } from "@/ui/series/series-screen";
import { loadView } from "@/app/views";

export default async function Page() {
  return <SeriesScreen {...await loadView("view.series")} />;
}
