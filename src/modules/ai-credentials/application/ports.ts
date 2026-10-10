export type StoredCredential = { encryptedApiKey: string; keyVersion: number };

export interface CredentialRepository {
  get(userId: string): Promise<StoredCredential | null>;
  upsert(userId: string, credential: StoredCredential & { provider: string }, now: Date): Promise<void>;
  delete(userId: string): Promise<void>;
}

export interface KeyCipher {
  readonly version: number;
  encrypt(plain: string): string;
  decrypt(encrypted: string): string;
}

export type ApiKeyTester = (apiKey: string) => Promise<boolean>;
