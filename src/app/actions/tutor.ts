"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ConversationReview, Correction } from "@/modules/conversations";
import { AppError } from "@/shared/errors";
import { requireUser } from "../session";
import { app, runAction, type ActionResult } from "./result";

const MAX_AUDIO_BASE64 = 2_100_000;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const AUDIO_MIME = /^audio\/[a-z0-9.+-]+(;[\w=.-]+)*$/i;

export type TurnView = {
  id: string;
  role: "user" | "tutor";
  text: string;
  translation: string | null;
  corrections: Correction[];
};

export async function startConversationAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  let sessionId = "";
  const result = await runAction("startConversation", async () => {
    const parsed = z
      .object({ themeId: z.string().max(30), customTopic: z.string().max(80).nullable() })
      .safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const started = await app().startConversation({
      userId: user.id,
      level: user.preferences.level,
      ...parsed.data,
    });
    sessionId = started.sessionId;
    return null;
  });
  if (result.ok) redirect(`/tutor/${sessionId}`);
  return result;
}

export async function sendMessageAction(
  input: unknown,
): Promise<ActionResult<{ userTurn: TurnView; tutorTurn: TurnView; queuedForReview: number }>> {
  const user = await requireUser();
  return runAction("sendMessage", async () => {
    const parsed = z
      .object({
        sessionId: z.uuid(),
        text: z.string().max(600).optional(),
        audio: z
          .object({
            mimeType: z.string().max(60).regex(AUDIO_MIME),
            base64: z.string().max(MAX_AUDIO_BASE64).regex(BASE64),
          })
          .optional(),
      })
      .safeParse(input);
    if (!parsed.success || (!parsed.data.text && !parsed.data.audio)) throw new AppError("INVALID_INPUT");
    const result = await app().sendMessage({
      userId: user.id,
      sessionId: parsed.data.sessionId,
      level: user.preferences.level,
      message: parsed.data.audio ? { audio: parsed.data.audio } : { text: parsed.data.text ?? "" },
    });
    const view = (turn: (typeof result)["userTurn"]): TurnView => ({
      id: turn.id,
      role: turn.role,
      text: turn.text,
      translation: turn.translation,
      corrections: turn.corrections,
    });
    return {
      userTurn: view(result.userTurn),
      tutorTurn: view(result.tutorTurn),
      queuedForReview: result.queuedForReview,
    };
  });
}

export async function reviewConversationAction(
  sessionId: unknown,
): Promise<ActionResult<{ review: ConversationReview; xpAwarded: number; queuedForReview: number }>> {
  const user = await requireUser();
  return runAction("reviewConversation", async () => {
    const parsed = z.uuid().safeParse(sessionId);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const result = await app().reviewConversation({
      userId: user.id,
      sessionId: parsed.data,
      level: user.preferences.level,
    });
    revalidatePath("/", "layout");
    return result;
  });
}
