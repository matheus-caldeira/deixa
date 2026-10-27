import { notFound } from "next/navigation";
import { getContainer } from "@/infrastructure/container";
import { CONVERSATION_XP, MIN_TURNS_FOR_XP } from "@/modules/conversations";
import { isAppError } from "@/shared/errors";
import { ToastProvider } from "@/ui/shell/toast";
import { ChatScreen } from "@/ui/talk/chat-screen";
import { requireUser } from "@/app/session";

export const dynamic = "force-dynamic";

export default async function ConversationPage(props: { searchParams: Promise<{ id?: string }> }) {
  const user = await requireUser();
  const { id: sessionId = "" } = await props.searchParams;
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
          closed: conversation.session.closedAt !== null,
          reviewStatus: conversation.session.reviewStatus,
          score:
            conversation.session.reviewStatus === "ready"
              ? (conversation.session.review?.score ?? null)
              : null,
          difficultyCount: conversation.session.review?.difficulties.length ?? 0,
          cardsConfirmed: conversation.session.cardsConfirmedAt !== null,
          minTurnsForXp: MIN_TURNS_FOR_XP,
          conversationXp: CONVERSATION_XP,
          turns: conversation.turns.map((turn) => ({
            id: turn.id,
            role: turn.role,
            text: turn.text,
            translation: turn.translation,
            corrections: turn.corrections,
            correctedText: turn.correctedText,
          })),
        }}
      />
    </ToastProvider>
  );
}
