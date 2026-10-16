import { notFound, redirect } from "next/navigation";
import { getContainer } from "@/infrastructure/container";
import { isAppError } from "@/shared/errors";
import { ToastProvider } from "@/ui/shell/toast";
import { ConversationReviewScreen } from "@/ui/talk/conversation-review-screen";
import { requireUser } from "../../../session";

export const dynamic = "force-dynamic";

export default async function ConversationReviewPage(props: { params: Promise<{ sessionId: string }> }) {
  const user = await requireUser();
  const { sessionId } = await props.params;
  const conversation = await getContainer()
    .getConversation(user.id, sessionId, user.preferences.targetLanguage)
    .catch((error: unknown) => {
      if (isAppError(error)) notFound();
      throw error;
    });
  const { session } = conversation;
  if (session.reviewStatus !== "ready" || !session.review) redirect(`/tutor/${sessionId}`);
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
