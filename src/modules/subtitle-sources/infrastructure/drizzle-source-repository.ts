import { and, count, eq, gt } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/infrastructure/database/client";
import { externalApiQuota, subtitleDownloads, subtitleSearchCache } from "@/infrastructure/database/schema";
import type { SubtitleCandidate } from "../domain/ranking";
import type { SourceProviderName, SourceQuota, SourceRepository } from "../application/source-use-cases";

const LANGUAGES = "en,pt-BR";

const candidatesSchema = z.array(
  z.object({
    fileId: z.string().min(1),
    language: z.enum(["en", "pt-BR"]),
    release: z.string(),
    fileName: z.string(),
    downloads: z.number(),
    rating: z.number(),
    hearingImpaired: z.boolean(),
    machineTranslated: z.boolean(),
    fps: z.number().nullable(),
    uploader: z.string().nullable(),
  }),
);

export class DrizzleSourceRepository implements SourceRepository {
  constructor(private readonly db: Database) {}

  async getCachedSearch(
    episodeId: string,
    provider: SourceProviderName,
  ): Promise<{ candidates: SubtitleCandidate[]; fetchedAt: Date } | null> {
    const [row] = await this.db
      .select()
      .from(subtitleSearchCache)
      .where(and(eq(subtitleSearchCache.episodeId, episodeId), eq(subtitleSearchCache.provider, provider)));
    if (!row) return null;
    const parsed = candidatesSchema.safeParse(row.resultsJson);
    return parsed.success ? { candidates: parsed.data, fetchedAt: row.fetchedAt } : null;
  }

  async saveSearch(
    episodeId: string,
    provider: SourceProviderName,
    candidates: SubtitleCandidate[],
    now: Date,
  ): Promise<void> {
    const values = { provider, languages: LANGUAGES, resultsJson: candidates, fetchedAt: now };
    await this.db
      .insert(subtitleSearchCache)
      .values({ episodeId, ...values })
      .onConflictDoUpdate({ target: subtitleSearchCache.episodeId, set: values });
  }

  async getQuota(provider: SourceProviderName): Promise<(SourceQuota & { updatedAt: Date }) | null> {
    const [row] = await this.db
      .select()
      .from(externalApiQuota)
      .where(eq(externalApiQuota.provider, provider));
    return row ? { remaining: row.remaining, resetAt: row.resetAt, updatedAt: row.updatedAt } : null;
  }

  async saveQuota(provider: SourceProviderName, quota: SourceQuota, now: Date): Promise<void> {
    const values = { remaining: quota.remaining, resetAt: quota.resetAt, updatedAt: now };
    await this.db
      .insert(externalApiQuota)
      .values({ provider, ...values })
      .onConflictDoUpdate({ target: externalApiQuota.provider, set: values });
  }

  async recordDownload(
    userId: string,
    provider: SourceProviderName,
    fileId: string,
    now: Date,
  ): Promise<void> {
    await this.db
      .insert(subtitleDownloads)
      .values({ userId, provider, externalFileId: fileId, createdAt: now });
  }

  async countUserDownloads(userId: string, provider: SourceProviderName, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(subtitleDownloads)
      .where(
        and(
          eq(subtitleDownloads.userId, userId),
          eq(subtitleDownloads.provider, provider),
          gt(subtitleDownloads.createdAt, since),
        ),
      );
    return row?.total ?? 0;
  }
}
