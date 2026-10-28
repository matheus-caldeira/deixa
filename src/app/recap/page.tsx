import { ToastProvider } from "@/ui/shell/toast";
import { RecapScreen } from "@/ui/review/recap-screen";
import { loadView } from "@/app/views";

export const dynamic = "force-dynamic";

export default async function Page(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <ToastProvider>
      <RecapScreen {...await loadView("view.recap", await props.searchParams)} />
    </ToastProvider>
  );
}
