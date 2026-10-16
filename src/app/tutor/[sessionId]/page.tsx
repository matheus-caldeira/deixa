import { notFound } from "next/navigation";
import { getContainer } from "@/infrastructure/container";
import { isAppError } from "@/shared/errors";
import { ToastProvider } from "@/ui/shell/toast";
import { ChatScreen } from "@/ui/talk/chat-screen";
import { requireUser } from "../../session";

export const dynamic = "force-dynamic";

export default async function ConversationPage(props: { params: Promise<{ sessionId: string }> }) {
  const user = await requireUser();
  const { sessionId } = await props.params;
  const conversation = await getContainer()
    .getConversation(user.id, sessionId, user.preferences.targetLanguage)
    .catch((error: unknown) => {
      if (isAppError(error)) notFound();
      throw error;
    });
  return (
    <ToastProvider>
      <ChatScreen
        view={{
          sessionId,
          themeId: conversation.session.themeId,
          title: conversation.session.themeTitle,
          level: user.preferences.level,
          accent: user.preferences.preferredAccent,
          audioSpeed: user.preferences.audioSpeed,
          simulated: conversation.simulated,
          turnsLeft: conversation.turnsLeft,
          review: conversation.session.review,
          turns: conversation.turns.map((turn) => ({
            id: turn.id,
            role: turn.role,
            text: turn.text,
            translation: turn.translation,
            corrections: turn.corrections,
          })),
        }}
      />
    </ToastProvider>
  );
}
