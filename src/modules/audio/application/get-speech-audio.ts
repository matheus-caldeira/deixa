import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import type { FileStorage } from "@/shared/storage";
import { audioHash, audioStoragePath, looksLikeWav, normalizeSpeechText, type Voice } from "../domain/speech";
import type { AudioAssetRepository, ConcurrencyGate, TtsProvider, TtsProviderName } from "./ports";

export type SpeechAudio = { bytes: Uint8Array; cache: "hit" | "miss"; provider: TtsProviderName };

type Deps = {
  assets: AudioAssetRepository;
  storage: FileStorage;
  primary: TtsProvider;
  fallback: TtsProvider;
  gate: ConcurrencyGate;
  clock: Clock;
  ids: IdGenerator;
  onPrimaryFailure?: (reason: string) => void;
};

export function makeGetSpeechAudio(deps: Deps) {
  async function fromCache(
    provider: TtsProvider,
    text: string,
    requested: Voice,
  ): Promise<Uint8Array | null> {
    const voice = provider.voiceFor(requested);
    const hash = audioHash({ text, ...voice, modelVersion: provider.modelVersion });
    const asset = await deps.assets.find(hash, voice.voiceId);
    if (!asset) return null;
    const bytes = await deps.storage.read(asset.storagePath);
    return bytes && looksLikeWav(bytes) ? bytes : null;
  }

  async function generate(provider: TtsProvider, text: string, requested: Voice): Promise<Uint8Array> {
    const voice = provider.voiceFor(requested);
    const bytes = await provider.synthesize({ text, voice });
    if (!looksLikeWav(bytes)) throw new Error("generated audio in unexpected format");
    const hash = audioHash({ text, ...voice, modelVersion: provider.modelVersion });
    const storagePath = audioStoragePath(voice.voiceId, hash);
    await deps.storage.write(storagePath, bytes);
    await deps.assets.save(
      {
        id: deps.ids.next(),
        textHash: hash,
        voiceId: voice.voiceId,
        language: voice.language,
        modelVersion: provider.modelVersion,
        format: "wav",
        storagePath,
      },
      deps.clock.now(),
    );
    return bytes;
  }

  return async function getSpeechAudio(input: {
    userId: string;
    text: string;
    voice: Voice;
  }): Promise<SpeechAudio> {
    const text = normalizeSpeechText(input.text);
    if (text.length === 0) throw new AppError("AUDIO_UNAVAILABLE");

    const cached = await fromCache(deps.primary, text, input.voice);
    if (cached) return { bytes: cached, cache: "hit", provider: deps.primary.name };

    if (!deps.gate.tryEnter(input.userId)) {
      throw new AppError("AUDIO_BUSY");
    }
    try {
      try {
        return {
          bytes: await generate(deps.primary, text, input.voice),
          cache: "miss",
          provider: deps.primary.name,
        };
      } catch (error) {
        deps.onPrimaryFailure?.(error instanceof Error ? error.message : "falha desconhecida");
      }
      const cachedFallback = await fromCache(deps.fallback, text, input.voice);
      if (cachedFallback) return { bytes: cachedFallback, cache: "hit", provider: deps.fallback.name };
      return {
        bytes: await generate(deps.fallback, text, input.voice),
        cache: "miss",
        provider: deps.fallback.name,
      };
    } finally {
      deps.gate.leave(input.userId);
    }
  };
}

export function makeListCachedSpeech(deps: Pick<Deps, "assets" | "primary">) {
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
