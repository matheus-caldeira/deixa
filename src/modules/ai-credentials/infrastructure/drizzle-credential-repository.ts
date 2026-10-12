import { and, eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { appCredentials, userAiCredentials } from "@/infrastructure/database/schema";
import type { CredentialRepository, ServiceCredential, StoredCredential } from "../application/ports";
import { isCredentialService, type CredentialService } from "../domain/services";

type Row = { provider: string; encryptedApiKey: string; keyVersion: number };

const toServiceCredentials = (rows: Row[]): ServiceCredential[] =>
  rows.flatMap((row) =>
    isCredentialService(row.provider)
      ? [{ service: row.provider, encryptedApiKey: row.encryptedApiKey, keyVersion: row.keyVersion }]
      : [],
  );

export class DrizzleCredentialRepository implements CredentialRepository {
  constructor(private readonly db: Database) {}

  async getForUser(userId: string, service: CredentialService): Promise<StoredCredential | null> {
    const [row] = await this.db
      .select({
        encryptedApiKey: userAiCredentials.encryptedApiKey,
        keyVersion: userAiCredentials.keyVersion,
      })
      .from(userAiCredentials)
      .where(and(eq(userAiCredentials.userId, userId), eq(userAiCredentials.provider, service)))
      .limit(1);
    return row ?? null;
  }

  async listForUser(userId: string): Promise<ServiceCredential[]> {
    const rows = await this.db
      .select({
        provider: userAiCredentials.provider,
        encryptedApiKey: userAiCredentials.encryptedApiKey,
        keyVersion: userAiCredentials.keyVersion,
      })
      .from(userAiCredentials)
      .where(eq(userAiCredentials.userId, userId));
    return toServiceCredentials(rows);
  }

  async upsertForUser(
    userId: string,
    service: CredentialService,
    credential: StoredCredential,
    now: Date,
  ): Promise<void> {
    const values = { ...credential, updatedAt: now };
    await this.db
      .insert(userAiCredentials)
      .values({ userId, provider: service, ...values })
      .onConflictDoUpdate({ target: [userAiCredentials.userId, userAiCredentials.provider], set: values });
  }

  async deleteForUser(userId: string, service: CredentialService): Promise<void> {
    await this.db
      .delete(userAiCredentials)
      .where(and(eq(userAiCredentials.userId, userId), eq(userAiCredentials.provider, service)));
  }

  async getGlobal(service: CredentialService): Promise<StoredCredential | null> {
    const [row] = await this.db
      .select({ encryptedApiKey: appCredentials.encryptedApiKey, keyVersion: appCredentials.keyVersion })
      .from(appCredentials)
      .where(eq(appCredentials.provider, service))
      .limit(1);
    return row ?? null;
  }

  async listGlobal(): Promise<ServiceCredential[]> {
    const rows = await this.db
      .select({
        provider: appCredentials.provider,
        encryptedApiKey: appCredentials.encryptedApiKey,
        keyVersion: appCredentials.keyVersion,
      })
      .from(appCredentials);
    return toServiceCredentials(rows);
  }

  async upsertGlobal(
    service: CredentialService,
    credential: StoredCredential,
    updatedBy: string,
    now: Date,
  ): Promise<void> {
    const values = { ...credential, updatedBy, updatedAt: now };
    await this.db
      .insert(appCredentials)
      .values({ provider: service, ...values })
      .onConflictDoUpdate({ target: appCredentials.provider, set: values });
  }

  async deleteGlobal(service: CredentialService): Promise<void> {
    await this.db.delete(appCredentials).where(eq(appCredentials.provider, service));
  }
}
