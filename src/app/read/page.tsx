import { ToastProvider } from "@/ui/shell/toast";
import { ReadScreen } from "@/ui/read/read-screen";
import { loadView } from "@/app/views";

export const dynamic = "force-dynamic";

export default async function Page(page: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { viewKey, ...props } = await loadView("view.read", await page.searchParams);
  return (
    <ToastProvider>
      <ReadScreen key={viewKey} {...props} />
    </ToastProvider>
  );
}
