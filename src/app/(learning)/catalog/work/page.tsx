import { MediaDetailScreen } from "@/ui/catalog/media-detail-screen";
import { loadView } from "@/app/views";

export default async function Page(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { viewKey, ...rest } = await loadView("view.work", await props.searchParams);
  return <MediaDetailScreen key={viewKey} {...rest} />;
}
