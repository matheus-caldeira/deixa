import { AppError } from "@/shared/errors";
import { audioHash, normalizeSpeechText, type Voice } from "../domain/speech";
import type { AudioAssetRepository, ConcurrencyGate, TtsProvider, TtsProviderName } from "./ports";
import { findCachedSpeech, generateSpeech, type SpeechCacheDeps } from "./speech-cache";

export type SpeechAudio = { bytes: Uint8Array; cache: "hit" | "miss"; provider: TtsProviderName };

type Deps = SpeechCacheDeps & {
  primary: TtsProvider;
  fallback: TtsProvider;
  gate: ConcurrencyGate;
  onPrimaryFailure?: (reason: string) => void;
};

export function makeGetSpeechAudio(deps: Deps) {
  return async function getSpeechAudio(input: {
    userId: string;
    text: string;
    voice: Voice;
  }): Promise<SpeechAudio> {
    const text = normalizeSpeechText(input.text);
    if (text.length === 0) throw new AppError("AUDIO_UNAVAILABLE");

    const cached = await findCachedSpeech(deps, deps.primary, text, input.voice);
    if (cached) return { bytes: cached, cache: "hit", provider: deps.primary.name };

    if (!deps.gate.tryEnter(input.userId)) {
      throw new AppError("AUDIO_BUSY");
    }
    try {
      try {
        return {
          bytes: await generateSpeech(deps, deps.primary, text, input.voice),
          cache: "miss",
          provider: deps.primary.name,
        };
      } catch (error) {
        deps.onPrimaryFailure?.(error instanceof Error ? error.message : "falha desconhecida");
      }
      const cachedFallback = await findCachedSpeech(deps, deps.fallback, text, input.voice);
      if (cachedFallback) return { bytes: cachedFallback, cache: "hit", provider: deps.fallback.name };
      return {
        bytes: await generateSpeech(deps, deps.fallback, text, input.voice),
        cache: "miss",
        provider: deps.fallback.name,
      };
    } finally {
      deps.gate.leave(input.userId);
    }
  };
}

export function makeListCachedSpeech(deps: { assets: AudioAssetRepository; primary: TtsProvider }) {
  return async function listCachedSpeech(input: {
    voice: Voice;
    lines: { id: string; text: string }[];
  }): Promise<string[]> {
    const voice = deps.primary.voiceFor(input.voice);
    const hashById = new Map(
      input.lines.map((line) => [
        line.id,
        audioHash({ text: line.text, ...voice, modelVersion: deps.primary.modelVersion }),
      ]),
    );
    const existing = await deps.assets.findExisting(voice.voiceId, [...new Set(hashById.values())]);
    return input.lines.filter((line) => existing.has(hashById.get(line.id) ?? "")).map((line) => line.id);
  };
}
