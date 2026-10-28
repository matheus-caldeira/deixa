import { z } from "zod";
import type { ComponentProps } from "react";
import { CONVERSATION_XP, MIN_TURNS_FOR_XP } from "@/modules/conversations";
import { AppError, isAppError } from "@/shared/errors";
import { operation } from "../operation";
import type { ChatScreen } from "@/ui/talk/chat-screen";

export const dynamic = "force-dynamic";

export const conversationView = {
  "view.conversation": operation({
    input: z.object({ id: z.string().optional() }),
    run: async (operationContext, input): Promise<ComponentProps<typeof ChatScreen>> => {
      const { user, app } = operationContext;

      const { id: sessionId = "" } = input;
      const conversation = await app
        .getConversation(user.id, sessionId, user.preferences.targetLanguage)
        .catch((error: unknown) => {
          if (isAppError(error)) throw new AppError("MEDIA_NOT_FOUND");
          throw error;
        });

      return {
        view: {
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
        },
      };
    },
  }),
};
