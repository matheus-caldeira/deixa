import { z } from "zod";
import { AppError } from "@/shared/errors";
import { cleanLlmText } from "@/shared/llm-text";
import type { StudyLanguage } from "@/shared/study-languages";

export const MAX_SPEECH_BYTES = 1_500_000;
export const MAX_TRANSCRIPT_CHARS = 600;
export const SPEECH_MIME = /^audio\/[a-z0-9.+-]+(;[\w=.-]+)*$/i;

export type SpeechClip = { mimeType: string; bytes: Uint8Array };

export interface SpeechToText {
  readonly model: string;
  transcribe(input: { clip: SpeechClip; language: StudyLanguage }): Promise<unknown>;
}

const outputSchema = z.object({ transcript: z.string() });

export function makeTranscribeSpeech(deps: {
  resolveTranscriber: (userId: string) => Promise<SpeechToText | null>;
}) {
  return async function transcribeSpeech(input: {
    userId: string;
    clip: SpeechClip;
    language: StudyLanguage;
  }): Promise<{ text: string }> {
    if (!SPEECH_MIME.test(input.clip.mimeType) || input.clip.bytes.byteLength === 0) {
      throw new AppError("INVALID_INPUT", "audioInvalid");
    }
    if (input.clip.bytes.byteLength > MAX_SPEECH_BYTES) throw new AppError("INVALID_INPUT", "audioInvalid");
    const transcriber = await deps.resolveTranscriber(input.userId);
    if (!transcriber) throw new AppError("LLM_FAILED", "transcriptionNoAi");
    const parsed = outputSchema.safeParse(
      await transcriber.transcribe({ clip: input.clip, language: input.language }),
    );
    const text = parsed.success ? cleanLlmText(parsed.data.transcript, MAX_TRANSCRIPT_CHARS) : null;
    if (!text) throw new AppError("LLM_INVALID_OUTPUT", "audioNotUnderstood");
    return { text };
  };
}
