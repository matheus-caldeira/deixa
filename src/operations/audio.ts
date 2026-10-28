import { z } from "zod";
import { operation } from "./operation";

export const SPEECH_KINDS = ["cue", "item", "turn"] as const;

export const audioOperations = {
  "audio.speechText": operation({
    input: z.object({ kind: z.enum(SPEECH_KINDS), id: z.uuid() }),
    run: async ({ user, app }, { kind, id }) => {
      if (kind === "cue") return app.getCueSpeech(id);
      if (kind === "item") return app.getSpeakableItem(user.id, id);
      return app.getTurnSpeech(user.id, id);
    },
  }),
};
