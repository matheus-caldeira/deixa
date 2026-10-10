import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import { looksLikeGoogleApiKey, maskApiKey } from "../domain/api-key";
import type { ApiKeyTester, CredentialRepository, KeyCipher } from "./ports";

const PROVIDER = "google-gemini";

type Deps = { credentials: CredentialRepository; cipher: KeyCipher; testApiKey: ApiKeyTester; clock: Clock };

export type KeyStatus = { connected: boolean; masked: string | null };

export function makeSaveApiKey(deps: Deps) {
  return async function saveApiKey(userId: string, rawKey: string): Promise<KeyStatus> {
    const apiKey = rawKey.trim();
    if (!looksLikeGoogleApiKey(apiKey)) {
      throw new AppError(
        "AI_KEY_INVALID",
        'Essa chave não parece válida. Chaves do Google AI Studio começam com "AIza" e têm 39 caracteres.',
      );
    }
    if (!(await deps.testApiKey(apiKey))) {
      throw new AppError("AI_KEY_REJECTED", "O Google recusou essa chave. Confira se ela está ativa.");
    }
    await deps.credentials.upsert(
      userId,
      { provider: PROVIDER, encryptedApiKey: deps.cipher.encrypt(apiKey), keyVersion: deps.cipher.version },
      deps.clock.now(),
    );
    return { connected: true, masked: maskApiKey(apiKey) };
  };
}

export function makeGetKeyStatus(deps: Pick<Deps, "credentials" | "cipher">) {
  return async function getKeyStatus(userId: string): Promise<KeyStatus> {
    const stored = await deps.credentials.get(userId);
    if (!stored) return { connected: false, masked: null };
    return { connected: true, masked: maskApiKey(deps.cipher.decrypt(stored.encryptedApiKey)) };
  };
}

export function makeRemoveApiKey(deps: Pick<Deps, "credentials">) {
  return async function removeApiKey(userId: string): Promise<void> {
    await deps.credentials.delete(userId);
  };
}

export function makeResolveApiKey(deps: Pick<Deps, "credentials" | "cipher">) {
  return async function resolveApiKey(userId: string): Promise<string | null> {
    const stored = await deps.credentials.get(userId);
    return stored ? deps.cipher.decrypt(stored.encryptedApiKey) : null;
  };
}
