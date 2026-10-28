import { WorkTrailScreen } from "@/ui/trail/work-trail-screen";
import { loadView } from "@/app/views";

export default async function Page(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <WorkTrailScreen {...await loadView("view.trail", await props.searchParams)} />;
}
