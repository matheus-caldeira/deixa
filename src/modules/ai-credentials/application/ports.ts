import type { CredentialService } from "../domain/services";

export type StoredCredential = { encryptedApiKey: string; keyVersion: number };
export type ServiceCredential = StoredCredential & { service: CredentialService };

export interface CredentialRepository {
  getForUser(userId: string, service: CredentialService): Promise<StoredCredential | null>;
  listForUser(userId: string): Promise<ServiceCredential[]>;
  upsertForUser(
    userId: string,
    service: CredentialService,
    credential: StoredCredential,
    now: Date,
  ): Promise<void>;
  deleteForUser(userId: string, service: CredentialService): Promise<void>;
  getGlobal(service: CredentialService): Promise<StoredCredential | null>;
  listGlobal(): Promise<ServiceCredential[]>;
  upsertGlobal(
    service: CredentialService,
    credential: StoredCredential,
    updatedBy: string,
    now: Date,
  ): Promise<void>;
  deleteGlobal(service: CredentialService): Promise<void>;
}

export interface KeyCipher {
  readonly version: number;
  encrypt(plain: string): string;
  decrypt(encrypted: string): string;
}

export type CredentialTester = (service: CredentialService, secret: string) => Promise<boolean>;
