import { ToastProvider } from "@/ui/shell/toast";
import { ListenScreen } from "@/ui/music/listen-screen";
import { loadView } from "@/app/views";

export const dynamic = "force-dynamic";

export default async function Page(page: { searchParams: Promise<Record<string, string | undefined>> }) {
  const view = await loadView("view.listen", await page.searchParams);
  return (
    <ToastProvider>
      <ListenScreen key={view.episodeId} view={view} />
    </ToastProvider>
  );
}
