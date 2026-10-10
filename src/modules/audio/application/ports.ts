import type { Voice } from "../domain/speech";

export type TtsProviderName = "kokoro" | "silent";

export interface TtsProvider {
  readonly name: TtsProviderName;
  readonly modelVersion: string;
  voiceFor(requested: Voice): Voice;
  synthesize(input: { text: string; voice: Voice }): Promise<Uint8Array>;
}

export type AudioAsset = { textHash: string; voiceId: string; storagePath: string };

export interface AudioAssetRepository {
  find(textHash: string, voiceId: string): Promise<AudioAsset | null>;
  findExisting(voiceId: string, textHashes: string[]): Promise<Set<string>>;
  save(
    asset: AudioAsset & { id: string; language: string; modelVersion: string; format: string },
    now: Date,
  ): Promise<void>;
}

export interface ConcurrencyGate {
  tryEnter(userId: string): boolean;
  leave(userId: string): void;
}
