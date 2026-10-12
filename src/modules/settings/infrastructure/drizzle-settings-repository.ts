import { sql } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { appSettings } from "@/infrastructure/database/schema";
import type { SettingsRepository } from "../application/settings-use-cases";
import { SETTING_KEYS, type AppSettings, type SettingKey } from "../domain/settings";

export class DrizzleSettingsRepository implements SettingsRepository {
  constructor(private readonly db: Database) {}

  async load(): Promise<Partial<Record<SettingKey, unknown>>> {
    const rows = await this.db.select({ key: appSettings.key, value: appSettings.value }).from(appSettings);
    const stored: Partial<Record<SettingKey, unknown>> = {};
    for (const row of rows) {
      const key = SETTING_KEYS.find((candidate) => candidate === row.key);
      if (key) stored[key] = (row.value as { value?: unknown }).value;
    }
    return stored;
  }

  async save(values: AppSettings, updatedBy: string, now: Date): Promise<void> {
    await this.db
      .insert(appSettings)
      .values(SETTING_KEYS.map((key) => ({ key, value: { value: values[key] }, updatedBy, updatedAt: now })))
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: sql`excluded.value`, updatedBy, updatedAt: now },
      });
  }
}
