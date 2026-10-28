import { ToastProvider } from "@/ui/shell/toast";
import { ConversationReviewScreen } from "@/ui/talk/conversation-review-screen";
import { loadView } from "@/app/views";

export const dynamic = "force-dynamic";

export default async function Page(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <ToastProvider>
      <ConversationReviewScreen {...await loadView("view.conversationReview", await props.searchParams)} />
    </ToastProvider>
  );
}
