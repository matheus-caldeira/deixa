import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import type { FileStorage } from "@/shared/storage";
import { audioHash, audioStoragePath, looksLikeWav, type Voice } from "../domain/speech";
import type { AudioAssetRepository, TtsProvider } from "./ports";

export type SpeechCacheDeps = {
  assets: AudioAssetRepository;
  storage: FileStorage;
  clock: Clock;
  ids: IdGenerator;
};

export async function findCachedSpeech(
  deps: Pick<SpeechCacheDeps, "assets" | "storage">,
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

export async function generateSpeech(
  deps: SpeechCacheDeps,
  provider: TtsProvider,
  text: string,
  requested: Voice,
): Promise<Uint8Array> {
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
