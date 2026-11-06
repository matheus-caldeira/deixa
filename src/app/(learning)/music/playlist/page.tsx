import { PlaylistScreen } from "@/ui/music/playlist-screen";
import { loadView } from "@/app/views";

export const dynamic = "force-dynamic";

export default async function Page(page: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <PlaylistScreen view={await loadView("view.playlist", await page.searchParams)} />;
}
