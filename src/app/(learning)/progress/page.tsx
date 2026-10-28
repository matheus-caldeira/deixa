import { ProgressScreen } from "@/ui/progress/progress-screen";
import { loadView } from "@/app/views";

export default async function Page() {
  return <ProgressScreen {...await loadView("view.progress")} />;
}
