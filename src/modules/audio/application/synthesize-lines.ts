import { AppError } from "@/shared/errors";
import { audioHash, normalizeSpeechText, type Voice } from "../domain/speech";
import type { TtsProvider } from "./ports";
import { generateSpeech, type SpeechCacheDeps } from "./speech-cache";

export type BatchSynthesis = { generated: number; cached: number; skipped: number };

const MAX_CONSECUTIVE_FAILURES = 3;

export function makeSynthesizeLines(deps: SpeechCacheDeps & { primary: TtsProvider }) {
  return async function synthesizeLines(input: {
    voice: Voice;
    lines: { id: string; text: string }[];
  }): Promise<BatchSynthesis> {
    if (deps.primary.name === "silent") return { generated: 0, cached: 0, skipped: input.lines.length };
    const voice = deps.primary.voiceFor(input.voice);
    const texts = new Map<string, string>();
    for (const line of input.lines) {
      const text = normalizeSpeechText(line.text);
      if (text.length === 0) continue;
      texts.set(audioHash({ text, ...voice, modelVersion: deps.primary.modelVersion }), text);
    }
    const existing = await deps.assets.findExisting(voice.voiceId, [...texts.keys()]);
    let generated = 0;
    let failures = 0;
    for (const [hash, text] of texts) {
      if (existing.has(hash)) continue;
      try {
        await generateSpeech(deps, deps.primary, text, voice);
        generated += 1;
        failures = 0;
      } catch (error) {
        failures += 1;
        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          throw new AppError("AUDIO_UNAVAILABLE", error instanceof Error ? error.message : undefined);
        }
      }
    }
    return { generated, cached: existing.size, skipped: input.lines.length - texts.size };
  };
}
