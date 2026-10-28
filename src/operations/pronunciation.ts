import { z } from "zod";
import { comparePronunciation, MAX_SPEECH_BYTES, SPEECH_MIME } from "@/modules/audio";
import { pairOf } from "@/modules/identity";
import { base64ToBytes } from "@/shared/base64";
import { operation } from "./operation";

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const BASE64_PER_BYTE = 4 / 3;

export const pronunciationOperations = {
  "pronunciation.check": operation({
    input: z.object({
      itemId: z.uuid(),
      audio: z.object({
        mimeType: z.string().max(60).regex(SPEECH_MIME),
        base64: z
          .string()
          .max(Math.ceil(MAX_SPEECH_BYTES * BASE64_PER_BYTE) + 4)
          .regex(BASE64),
      }),
    }),
    run: async ({ user, app }, input) => {
      const expected = await app.getSpeakableItem(user.id, input.itemId);
      const { text } = await app.transcribeSpeech({
        userId: user.id,
        clip: { mimeType: input.audio.mimeType, bytes: base64ToBytes(input.audio.base64) },
        language: expected.language ?? pairOf(user.preferences).target,
      });
      return { expected: expected.text, heard: text, ...comparePronunciation(expected.text, text) };
    },
  }),
};
