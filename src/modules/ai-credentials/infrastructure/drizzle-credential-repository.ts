import { eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { userAiCredentials } from "@/infrastructure/database/schema";
import type { CredentialRepository, StoredCredential } from "../application/ports";

export class DrizzleCredentialRepository implements CredentialRepository {
  constructor(private readonly db: Database) {}

  async get(userId: string): Promise<StoredCredential | null> {
    const [row] = await this.db
      .select({
        encryptedApiKey: userAiCredentials.encryptedApiKey,
        keyVersion: userAiCredentials.keyVersion,
      })
      .from(userAiCredentials)
      .where(eq(userAiCredentials.userId, userId))
      .limit(1);
    return row ?? null;
  }

  async upsert(
    userId: string,
    credential: StoredCredential & { provider: string },
    now: Date,
  ): Promise<void> {
    const values = { ...credential, updatedAt: now };
    await this.db
      .insert(userAiCredentials)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: userAiCredentials.userId, set: values });
  }

  async delete(userId: string): Promise<void> {
    await this.db.delete(userAiCredentials).where(eq(userAiCredentials.userId, userId));
  }
}
