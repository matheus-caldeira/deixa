import type { CredentialService } from "../../domain/services";
import type { CredentialRepository, ServiceCredential, StoredCredential } from "../ports";

export class InMemoryCredentials implements CredentialRepository {
  readonly byUser = new Map<string, StoredCredential>();
  readonly global = new Map<CredentialService, StoredCredential & { updatedBy: string }>();

  private key(userId: string, service: CredentialService): string {
    return `${userId}|${service}`;
  }

  async getForUser(userId: string, service: CredentialService): Promise<StoredCredential | null> {
    return this.byUser.get(this.key(userId, service)) ?? null;
  }

  async listForUser(userId: string): Promise<ServiceCredential[]> {
    return [...this.byUser.entries()].flatMap(([key, stored]) => {
      const [owner, service] = key.split("|");
      return owner === userId ? [{ service: service as CredentialService, ...stored }] : [];
    });
  }

  async upsertForUser(
    userId: string,
    service: CredentialService,
    credential: StoredCredential,
  ): Promise<void> {
    this.byUser.set(this.key(userId, service), credential);
  }

  async deleteForUser(userId: string, service: CredentialService): Promise<void> {
    this.byUser.delete(this.key(userId, service));
  }

  async getGlobal(service: CredentialService): Promise<StoredCredential | null> {
    return this.global.get(service) ?? null;
  }

  async listGlobal(): Promise<ServiceCredential[]> {
    return [...this.global.entries()].map(([service, stored]) => ({
      service,
      encryptedApiKey: stored.encryptedApiKey,
      keyVersion: stored.keyVersion,
    }));
  }

  async upsertGlobal(
    service: CredentialService,
    credential: StoredCredential,
    updatedBy: string,
  ): Promise<void> {
    this.global.set(service, { ...credential, updatedBy });
  }

  async deleteGlobal(service: CredentialService): Promise<void> {
    this.global.delete(service);
  }
}
