import { runtime } from "./runtime-client";

export type SpeechKind = "cue" | "item" | "turn";

export type SpeechSource = { kind: "audio"; url: string } | { kind: "voice"; text: string; language: string };

export const BUSY_STATUS = 429;

export class SpeechUnavailable extends Error {
  constructor(readonly busy: boolean) {
    super("speech unavailable");
  }
}

export async function loadSpeech(kind: SpeechKind, id: string): Promise<SpeechSource> {
  if (typeof speechSynthesis === "undefined") throw new SpeechUnavailable(false);
  try {
    const { text, language } = (await runtime().call("audio.speechText", { kind, id })) as {
      text: string;
      language: string;
    };
    return { kind: "voice", text, language };
  } catch {
    throw new SpeechUnavailable(false);
  }
}
