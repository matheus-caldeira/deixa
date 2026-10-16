"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContainer } from "@/infrastructure/container";
import { voiceFor } from "@/modules/audio";
import {
  MAX_MARKED_TERMS,
  MAX_MARKED_TERM_LENGTH,
  MAX_DIFFICULTIES,
  type Correction,
} from "@/modules/conversations";
import { pairOf } from "@/modules/identity";
import { AppError } from "@/shared/errors";
import { scheduleJob } from "../schedule";
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
  correctedText: string | null;
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
      language: user.preferences.targetLanguage,
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
): Promise<ActionResult<{ userTurn: TurnView; tutorTurn: TurnView }>> {
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
      language: user.preferences.targetLanguage,
      message: parsed.data.audio ? { audio: parsed.data.audio } : { text: parsed.data.text ?? "" },
    });
    const view = (turn: (typeof result)["userTurn"]): TurnView => ({
      id: turn.id,
      role: turn.role,
      text: turn.text,
      translation: turn.translation,
      corrections: turn.corrections,
      correctedText: turn.correctedText,
    });
    return { userTurn: view(result.userTurn), tutorTurn: view(result.tutorTurn) };
  });
}

type SessionUser = Awaited<ReturnType<typeof requireUser>>;

async function scheduleReview(user: SessionUser, sessionId: string) {
  await scheduleJob(
    getContainer(),
    "conversation_review",
    { userId: user.id, sessionId, level: user.preferences.level },
    user.id,
  );
}

export async function closeConversationAction(
  input: unknown,
): Promise<ActionResult<{ xpAwarded: number; reviewQueued: boolean }>> {
  const user = await requireUser();
  return runAction("closeConversation", async () => {
    const parsed = z.object({ sessionId: z.uuid(), withReview: z.boolean() }).safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const container = getContainer();
    const result = await container.closeConversation({
      userId: user.id,
      language: user.preferences.targetLanguage,
      ...parsed.data,
    });
    if (result.reviewQueued) await scheduleReview(user, parsed.data.sessionId);
    if (container.audioBatchAvailable) {
      await scheduleJob(
        container,
        "conversation_audio",
        {
          userId: user.id,
          sessionId: parsed.data.sessionId,
          voice: voiceFor(user.preferences.targetLanguage, user.preferences.preferredAccent),
        },
        user.id,
      );
    }
    revalidatePath("/", "layout");
    return result;
  });
}

export async function requestConversationReviewAction(
  sessionId: unknown,
): Promise<ActionResult<{ reviewQueued: boolean }>> {
  const user = await requireUser();
  return runAction("requestConversationReview", async () => {
    const parsed = z.uuid().safeParse(sessionId);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const result = await app().requestConversationReview({
      userId: user.id,
      sessionId: parsed.data,
      language: user.preferences.targetLanguage,
    });
    if (result.reviewQueued) await scheduleReview(user, parsed.data);
    return result;
  });
}

export async function confirmConversationCardsAction(
  input: unknown,
): Promise<ActionResult<{ cards: number; newEpisodes: number }>> {
  const user = await requireUser();
  return runAction("confirmConversationCards", async () => {
    const parsed = z
      .object({
        sessionId: z.uuid(),
        difficultyIds: z.array(z.string().max(8)).max(MAX_DIFFICULTIES),
      })
      .safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const result = await app().confirmConversationCards({
      userId: user.id,
      language: user.preferences.targetLanguage,
      ...parsed.data,
    });
    if (result.cards > 0) {
      await scheduleJob(
        getContainer(),
        "personal_series_description",
        { userId: user.id, pair: pairOf(user.preferences), level: user.preferences.level },
        user.id,
      );
    }
    revalidatePath("/", "layout");
    return result;
  });
}

export async function requestTermCardsAction(input: unknown): Promise<ActionResult<{ terms: number }>> {
  const user = await requireUser();
  return runAction("requestTermCards", async () => {
    const parsed = z
      .object({
        sessionId: z.uuid(),
        marks: z
          .array(z.object({ turnId: z.uuid(), text: z.string().max(MAX_MARKED_TERM_LENGTH * 2) }))
          .min(1)
          .max(MAX_MARKED_TERMS * 2),
      })
      .safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const { terms } = await app().requestTermCards({
      userId: user.id,
      language: user.preferences.targetLanguage,
      ...parsed.data,
    });
    await scheduleJob(
      getContainer(),
      "conversation_terms",
      { userId: user.id, sessionId: parsed.data.sessionId, level: user.preferences.level, terms },
      user.id,
    );
    return { terms: terms.length };
  });
}
