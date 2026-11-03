import { and, count, eq, gt } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/infrastructure/database/client";
import { externalApiQuota, subtitleDownloads, subtitleSearchCache } from "@/infrastructure/database/schema";
import { isStudyLanguage, studyLanguageSchema } from "@/shared/study-languages";
import type {
  CachedSearch,
  SourceProviderName,
  SourceQuota,
  SourceRepository,
} from "../application/source-use-cases";

const LANGUAGE_SEPARATOR = ",";

const candidatesSchema = z.array(
  z.object({
    fileId: z.string().min(1),
    language: studyLanguageSchema,
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

  async getCachedSearch(episodeId: string, provider: SourceProviderName): Promise<CachedSearch | null> {
    const [row] = await this.db
      .select()
      .from(subtitleSearchCache)
      .where(and(eq(subtitleSearchCache.episodeId, episodeId), eq(subtitleSearchCache.provider, provider)));
    if (!row) return null;
    const parsed = candidatesSchema.safeParse(row.resultsJson);
    if (!parsed.success) return null;
    const languages = row.languages.split(LANGUAGE_SEPARATOR).filter(isStudyLanguage);
    return { languages, candidates: parsed.data, fetchedAt: row.fetchedAt };
  }

  async saveSearch(episodeId: string, provider: SourceProviderName, search: CachedSearch): Promise<void> {
    const values = {
      provider,
      languages: search.languages.join(LANGUAGE_SEPARATOR),
      resultsJson: search.candidates,
      fetchedAt: search.fetchedAt,
    };
    await this.db
      .insert(subtitleSearchCache)
      .values({ episodeId, ...values })
      .onConflictDoUpdate({ target: subtitleSearchCache.episodeId, set: values });
  }

  async getQuota(quotaKey: string): Promise<(SourceQuota & { updatedAt: Date }) | null> {
    const [row] = await this.db
      .select()
      .from(externalApiQuota)
      .where(eq(externalApiQuota.provider, quotaKey));
    return row ? { remaining: row.remaining, resetAt: row.resetAt, updatedAt: row.updatedAt } : null;
  }

  async saveQuota(quotaKey: string, quota: SourceQuota, now: Date): Promise<void> {
    const values = { remaining: quota.remaining, resetAt: quota.resetAt, updatedAt: now };
    await this.db
      .insert(externalApiQuota)
      .values({ provider: quotaKey, ...values })
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
