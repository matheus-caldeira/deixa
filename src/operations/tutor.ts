import { z } from "zod";
import { voiceFor } from "@/modules/audio";
import {
  MAX_DIFFICULTIES,
  MAX_EPISODE_OVERVIEW,
  MAX_MARKED_TERMS,
  MAX_MARKED_TERM_LENGTH,
  type Correction,
} from "@/modules/conversations";
import { pairOf, type SessionUser } from "@/modules/identity";
import { AppError } from "@/shared/errors";
import { operation, type ScheduleJob } from "./operation";

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

function scheduleReview(schedule: ScheduleJob, user: SessionUser, sessionId: string) {
  return schedule("conversation_review", { userId: user.id, sessionId, level: user.preferences.level });
}

export const tutorOperations = {
  "tutor.start": operation({
    input: z.object({ themeId: z.string().max(30), customTopic: z.string().max(80).nullable() }),
    run: async ({ user, app }, input) => {
      const { sessionId } = await app.startConversation({
        userId: user.id,
        level: user.preferences.level,
        language: user.preferences.targetLanguage,
        ...input,
      });
      return { sessionId };
    },
  }),
  "tutor.startEpisode": operation({
    input: z.unknown(),
    run: async ({ user, app, translator }, episodeId) => {
      const parsed = z.uuid().safeParse(episodeId);
      if (!parsed.success) throw new AppError("EPISODE_NOT_FOUND");
      const context = await app.getEpisodeContext(parsed.data);
      if (!context) throw new AppError("EPISODE_NOT_FOUND");
      const t = await translator("trail");
      const label =
        context.media.type === "movie"
          ? t("label.movie")
          : t("label.episode", {
              season: context.season.seasonNumber,
              episode: context.episode.episodeNumber,
            });
      const { sessionId } = await app.startConversation({
        userId: user.id,
        themeId: "episode",
        customTopic: null,
        level: user.preferences.level,
        language: user.preferences.targetLanguage,
        episode: {
          episodeId: context.episode.id,
          workTitle: context.media.title,
          label,
          title: context.episode.title,
          overview: context.episode.overview.slice(0, MAX_EPISODE_OVERVIEW),
        },
      });
      return { sessionId };
    },
  }),
  "tutor.send": operation({
    input: z.unknown(),
    run: async ({ user, app }, input) => {
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
      const result = await app.sendMessage({
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
    },
  }),
  "tutor.close": operation({
    input: z.object({ sessionId: z.uuid(), withReview: z.boolean() }),
    refresh: true,
    run: async ({ user, app, schedule }, input) => {
      const result = await app.closeConversation({
        userId: user.id,
        language: user.preferences.targetLanguage,
        ...input,
      });
      if (result.reviewQueued) await scheduleReview(schedule, user, input.sessionId);
      if (app.audioBatchAvailable) {
        await schedule("conversation_audio", {
          userId: user.id,
          sessionId: input.sessionId,
          voice: voiceFor(user.preferences.targetLanguage, user.preferences.preferredAccent),
        });
      }
      return result;
    },
  }),
  "tutor.requestReview": operation({
    input: z.uuid(),
    run: async ({ user, app, schedule }, sessionId) => {
      const result = await app.requestConversationReview({
        userId: user.id,
        sessionId,
        language: user.preferences.targetLanguage,
      });
      if (result.reviewQueued) await scheduleReview(schedule, user, sessionId);
      return result;
    },
  }),
  "tutor.confirmCards": operation({
    input: z.object({
      sessionId: z.uuid(),
      difficultyIds: z.array(z.string().max(8)).max(MAX_DIFFICULTIES),
    }),
    refresh: true,
    run: async ({ user, app, schedule }, input) => {
      const result = await app.confirmConversationCards({
        userId: user.id,
        language: user.preferences.targetLanguage,
        ...input,
      });
      if (result.cards > 0) {
        await schedule("personal_series_description", {
          userId: user.id,
          pair: pairOf(user.preferences),
          level: user.preferences.level,
        });
      }
      return result;
    },
  }),
  "tutor.requestTermCards": operation({
    input: z.object({
      sessionId: z.uuid(),
      marks: z
        .array(z.object({ turnId: z.uuid(), text: z.string().max(MAX_MARKED_TERM_LENGTH * 2) }))
        .min(1)
        .max(MAX_MARKED_TERMS * 2),
    }),
    run: async ({ user, app, schedule }, input) => {
      const { terms } = await app.requestTermCards({
        userId: user.id,
        language: user.preferences.targetLanguage,
        ...input,
      });
      await schedule("conversation_terms", {
        userId: user.id,
        sessionId: input.sessionId,
        level: user.preferences.level,
        terms,
      });
      return { terms: terms.length };
    },
  }),
};
