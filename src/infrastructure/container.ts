import { AesGcmCipher } from "@/modules/ai-credentials/infrastructure/aes-gcm-cipher";
import { HttpLevelSourceFetcher } from "@/modules/catalog/infrastructure/http-level-source-fetcher";
import { randomSessionTokens, scryptPasswords } from "@/modules/identity/infrastructure/crypto";
import { FakeSubtitleSourceProvider } from "@/modules/subtitle-sources/infrastructure/fake-subtitle-source-provider";
import { mergeSettings, type AppSettings } from "@/modules/settings";
import { DrizzleSettingsRepository } from "@/modules/settings/infrastructure/drizzle-settings-repository";
import { NodePersonalCipher } from "@/modules/packages/infrastructure/node-personal-cipher";
import { getEnv } from "./config/env";
import { loadMasterKey } from "./config/master-key";
import { sql } from "drizzle-orm";
import { configDirectory, readStoredDatabaseUrl } from "./config/local-config";
import { fileSetupCodeGate } from "./config/setup-code-gate";
import { openDatabase, type DatabaseHandle } from "./database/client";
import { KokoroTtsProvider } from "./kokoro/kokoro-tts-provider";
import { logger as defaultLogger } from "./logger/logger";
import { LocalFileStorage } from "./storage/local-file-storage";
import { buildAppContainer, settingsFromEnvironment, type ContainerOptions } from "./app-container";
import type { Platform } from "./platform";

export { settingsFromEnvironment, type ContainerOptions };

export const nodePlatform: Platform = {
  storage: (env) => new LocalFileStorage(env.DATA_DIR),
  passwords: scryptPasswords,
  tokens: randomSessionTokens,
  firstAccount: "setup-code",
  setupCode: fileSetupCodeGate(),
  cipher: (masterKey) => new AesGcmCipher(masterKey),
  personalCipher: new NodePersonalCipher(),
  levelSourceFetcher: (env) =>
    new HttpLevelSourceFetcher({ allowPrivateNetwork: env.LEVEL_SOURCES_ALLOW_PRIVATE_NETWORK }),
  tts: (url) => new KokoroTtsProvider(url),
  fakeSubtitleSource: () => new FakeSubtitleSourceProvider(),
};

export function buildContainer(options: ContainerOptions & { platform?: Platform }) {
  return buildAppContainer({ ...options, platform: options.platform ?? nodePlatform });
}

export type Container = ReturnType<typeof buildContainer>;

type ActiveDatabase = { url: string; handle: DatabaseHandle };
const globalStore = globalThis as typeof globalThis & { __deixaActiveDatabase?: ActiveDatabase };
let container: Container | undefined;
let containerUrl: string | undefined;

export class DatabaseNotConfigured extends Error {
  constructor() {
    super("database not configured");
    this.name = "DatabaseNotConfigured";
  }
}

export class SettingsNotLoaded extends Error {
  constructor() {
    super("server settings not loaded yet");
    this.name = "SettingsNotLoaded";
  }
}

export function resolveDatabaseUrl(): string | null {
  return getEnv().DATABASE_URL ?? readStoredDatabaseUrl(configDirectory());
}

function activeDatabase(url: string): DatabaseHandle {
  const active = globalStore.__deixaActiveDatabase;
  if (active?.url === url) return active.handle;
  void active?.handle.close().catch(() => undefined);
  const handle = openDatabase(url);
  globalStore.__deixaActiveDatabase = { url, handle };
  return handle;
}

let settingsSnapshot: { url: string; values: AppSettings; stamp: string } | undefined;
let containerSettings: string | undefined;

export async function pingDatabase(url: string): Promise<void> {
  await activeDatabase(url).db.execute(sql`select 1`);
}

export async function refreshSettings(): Promise<void> {
  const url = resolveDatabaseUrl();
  if (!url) return;
  const stored = await new DrizzleSettingsRepository(activeDatabase(url).db).load();
  const values = mergeSettings(settingsFromEnvironment(getEnv()), stored);
  settingsSnapshot = { url, values, stamp: JSON.stringify(values) };
}

export function getContainer(): Container {
  const url = resolveDatabaseUrl();
  if (!url) throw new DatabaseNotConfigured();
  const snapshot = settingsSnapshot?.url === url ? settingsSnapshot : undefined;
  if (!snapshot) throw new SettingsNotLoaded();
  if (!container || containerUrl !== url || containerSettings !== snapshot.stamp) {
    const env = getEnv();
    const masterKey = loadMasterKey({
      fromEnvironment: env.AI_CREDENTIALS_MASTER_KEY,
      directory: configDirectory(),
    });
    if (masterKey.origin === "created" || masterKey.origin === "replaced") {
      defaultLogger.warn("master_key.generated", { origin: masterKey.origin });
    }
    container = buildContainer({
      env,
      db: activeDatabase(url).db,
      masterKey: masterKey.value,
      settings: snapshot.values,
    });
    containerUrl = url;
    containerSettings = snapshot.stamp;
  }
  return container;
}
