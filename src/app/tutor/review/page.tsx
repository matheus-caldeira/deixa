import { notFound, redirect } from "next/navigation";
import { getContainer } from "@/infrastructure/container";
import { isAppError } from "@/shared/errors";
import { ToastProvider } from "@/ui/shell/toast";
import { ConversationReviewScreen } from "@/ui/talk/conversation-review-screen";
import { requireUser } from "@/app/session";
import { routes } from "@/shared/routes";

export const dynamic = "force-dynamic";

export default async function ConversationReviewPage(props: { searchParams: Promise<{ id?: string }> }) {
  const user = await requireUser();
  const { id: sessionId = "" } = await props.searchParams;
  const conversation = await getContainer()
    .getConversation(user.id, sessionId, user.preferences.targetLanguage)
    .catch((error: unknown) => {
      if (isAppError(error)) notFound();
      throw error;
    });
  const { session } = conversation;
  if (session.reviewStatus !== "ready" || !session.review) redirect(routes.conversation(sessionId));
  return (
    <ToastProvider>
      <ConversationReviewScreen
        view={{
          sessionId,
          themeId: session.themeId,
          title: session.themeTitle,
          review: session.review,
          cardsConfirmed: session.cardsConfirmedAt !== null,
          turns: conversation.turns.map((turn) => ({ id: turn.id, text: turn.text })),
        }}
      />
    </ToastProvider>
  );
}
