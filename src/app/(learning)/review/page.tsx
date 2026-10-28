import { ReviewPage } from "@/ui/review/review-page";
import { loadView } from "@/app/views";

export default async function Page(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <ReviewPage page={await loadView("view.review", await props.searchParams)} />;
}
