import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { audioAssets } from "@/infrastructure/database/schema";
import type { AudioAsset, AudioAssetRepository } from "../application/ports";

export class DrizzleAudioAssetRepository implements AudioAssetRepository {
  constructor(private readonly db: Database) {}

  async find(textHash: string, voiceId: string): Promise<AudioAsset | null> {
    const [row] = await this.db
      .select({
        textHash: audioAssets.textHash,
        voiceId: audioAssets.voiceId,
        storagePath: audioAssets.storagePath,
      })
      .from(audioAssets)
      .where(and(eq(audioAssets.textHash, textHash), eq(audioAssets.voiceId, voiceId)))
      .limit(1);
    return row ?? null;
  }

  async findExisting(voiceId: string, textHashes: string[]): Promise<Set<string>> {
    if (textHashes.length === 0) return new Set();
    const rows = await this.db
      .select({ textHash: audioAssets.textHash })
      .from(audioAssets)
      .where(and(eq(audioAssets.voiceId, voiceId), inArray(audioAssets.textHash, textHashes)));
    return new Set(rows.map((row) => row.textHash));
  }

  async save(
    asset: AudioAsset & { id: string; language: string; modelVersion: string; format: string },
    now: Date,
  ): Promise<void> {
    await this.db
      .insert(audioAssets)
      .values({ ...asset, status: "READY", createdAt: now })
      .onConflictDoUpdate({
        target: [audioAssets.textHash, audioAssets.voiceId],
        set: { storagePath: asset.storagePath, status: "READY" },
      });
  }
}
