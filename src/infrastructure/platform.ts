import type { KeyCipher } from "@/modules/ai-credentials";
import type { TtsProvider } from "@/modules/audio";
import type { LevelSourceFetcher } from "@/modules/catalog";
import type { FirstAccountPolicy, PasswordHasher, SessionTokens, SetupCodeGate } from "@/modules/identity";
import type { PersonalCipher } from "@/modules/packages";
import type { SubtitleSourceProvider } from "@/modules/subtitle-sources";
import type { FileStorage } from "@/shared/storage";
import type { Env } from "./config/env";

export type Platform = {
  storage: (env: Env) => FileStorage;
  passwords: PasswordHasher;
  tokens: SessionTokens;
  firstAccount: FirstAccountPolicy;
  setupCode?: SetupCodeGate;
  cipher: (masterKey: string) => KeyCipher;
  personalCipher: PersonalCipher;
  levelSourceFetcher: (env: Env) => LevelSourceFetcher;
  tts: (url: string) => TtsProvider;
  fakeSubtitleSource: () => SubtitleSourceProvider;
};
