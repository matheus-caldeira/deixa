import { z } from "zod";
import type { ComponentProps } from "react";
import { AppError, isAppError } from "@/shared/errors";
import { routes } from "@/shared/routes";
import { operation, ViewRedirect } from "../operation";
import type { ConversationReviewScreen } from "@/ui/talk/conversation-review-screen";

export const dynamic = "force-dynamic";

export const conversationReviewView = {
  "view.conversationReview": operation({
    input: z.object({ id: z.string().optional() }),
    run: async (operationContext, input): Promise<ComponentProps<typeof ConversationReviewScreen>> => {
      const { user, app } = operationContext;

      const { id: sessionId = "" } = input;
      const conversation = await app
        .getConversation(user.id, sessionId, user.preferences.targetLanguage)
        .catch((error: unknown) => {
          if (isAppError(error)) throw new AppError("MEDIA_NOT_FOUND");
          throw error;
        });
      const { session } = conversation;
      if (session.reviewStatus !== "ready" || !session.review)
        throw new ViewRedirect(routes.conversation(sessionId));

      return {
        view: {
          sessionId,
          themeId: session.themeId,
          title: session.themeTitle,
          review: session.review,
          cardsConfirmed: session.cardsConfirmedAt !== null,
          turns: conversation.turns.map((turn) => ({ id: turn.id, text: turn.text })),
        },
      };
    },
  }),
};
