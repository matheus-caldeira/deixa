import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createTranslator } from "next-intl";
import { z } from "zod";
import {
  buildAppContainer,
  settingsFromEnvironment,
  type AppContainer,
} from "@/infrastructure/app-container";
import { parseEnv } from "@/infrastructure/config/env";
import { applyMigrations, pendingMigrations } from "@/infrastructure/database/apply-migrations";
import * as schema from "@/infrastructure/database/schema";
import { silentLogger } from "@/infrastructure/logger/logger";
import type { SessionUser } from "@/modules/identity";
import { mergeSettings } from "@/modules/settings";
import { DrizzleSettingsRepository } from "@/modules/settings/infrastructure/drizzle-settings-repository";
import {
  execute,
  REDIRECT_CODE,
  ViewRedirect,
  type AnyOperation,
  type OperationContext,
} from "@/operations/operation";
import { OPERATIONS } from "@/operations/registry";
import { AppError, isAppError } from "@/shared/errors";
import { CEFR_LEVELS } from "@/shared/levels";
import { localeSchema, type Locale } from "@/shared/locales";
import { studyLanguageSchema } from "@/shared/study-languages";
import en from "../../locales/en.json";
import ptBR from "../../locales/pt-BR.json";
import { backupBeforeMigration } from "./backups";
import { loadMasterKey, localSession } from "./local-secrets";
import { browserPlatform } from "./platform";
import {
  BROWSER_DATA_DIR,
  DATABASE_LOCK,
  runtimeRequestSchema,
  type RuntimeError,
  type RuntimeMessage,
  type RuntimeStatus,
} from "./protocol";

const MESSAGES: Record<Locale, typeof ptBR> = { "pt-BR": ptBR, en };

const signInSchema = z.object({ email: z.string().max(200), password: z.string().max(200) });
const signUpSchema = signInSchema.extend({
  name: z.string().max(80),
  level: z.enum(CEFR_LEVELS),
  nativeLanguage: studyLanguageSchema,
  targetLanguage: studyLanguageSchema,
  locale: localeSchema,
});

type Runtime = { app: AppContainer; db: ReturnType<typeof drizzle<typeof schema>> };

const scope = globalThis as unknown as {
  postMessage: (message: RuntimeMessage) => void;
  onmessage: ((event: MessageEvent) => void) | null;
};

let runtime: Runtime | null = null;
let markReady: () => void = () => undefined;
const ready = new Promise<void>((resolve) => {
  markReady = resolve;
});

function publish(status: RuntimeStatus) {
  scope.postMessage({ kind: "status", status });
}

async function buildRuntime(db: Runtime["db"]): Promise<Runtime> {
  const env = parseEnv({ JOBS_MODE: "inline", SESSION_COOKIE_SECURE: "false" });
  const stored = await new DrizzleSettingsRepository(db).load();
  const app = buildAppContainer({
    env,
    db,
    platform: browserPlatform,
    logger: silentLogger,
    masterKey: await loadMasterKey(),
    settings: mergeSettings(settingsFromEnvironment(env), stored),
  });
  return { app, db };
}

async function drainJobs(app: AppContainer): Promise<void> {
  while ((await app.runNextJob()) !== null) scope.postMessage({ kind: "changed" });
}

async function currentUser(app: AppContainer): Promise<SessionUser | null> {
  const token = await localSession.read();
  return token ? app.getSessionUser(token) : null;
}

function contextFor(user: SessionUser): OperationContext {
  const active = runtime;
  if (!active) throw new Error("runtime not ready");
  return {
    user,
    app: active.app,
    schedule: async (kind, payload) => {
      const { jobId } = await active.app.enqueueJob({ kind, payload, createdBy: user.id });
      void active.app
        .runJobInline(jobId)
        .catch(() => undefined)
        .then(() => scope.postMessage({ kind: "changed" }));
      return { jobId };
    },
    refreshSettings: async () => {
      runtime = await buildRuntime(active.db);
    },
    readSample: async () => null,
    translator: async (namespace) => {
      const locale = user.preferences.locale;
      const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: namespace as never });
      return (key, params) =>
        (t as (key: string, params?: Record<string, string | number>) => string)(key, params);
    },
  };
}

async function authenticate(app: AppContainer, credentials: z.infer<typeof signInSchema>) {
  const session = await app.signIn(credentials);
  await localSession.write(session.token);
  return currentUser(app);
}

async function handle(operation: string, input: unknown): Promise<unknown> {
  await ready;
  const active = runtime;
  if (!active) throw new Error("runtime not ready");
  const { app } = active;
  if (operation === "auth.status") return { user: await currentUser(app) };
  if (operation === "auth.signIn") {
    const parsed = signInSchema.safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_CREDENTIALS");
    return { user: await authenticate(app, parsed.data) };
  }
  if (operation === "auth.signUp") {
    const parsed = signUpSchema.safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const { nativeLanguage, targetLanguage, locale, ...account } = parsed.data;
    await app.signUp({ ...account, locale, pair: { target: targetLanguage, native: nativeLanguage } });
    return { user: await authenticate(app, { email: account.email, password: account.password }) };
  }
  if (operation === "auth.signOut") {
    await app.signOut((await localSession.read()) ?? undefined);
    await localSession.clear();
    return { user: null };
  }
  const definition: AnyOperation | undefined = OPERATIONS[operation as keyof typeof OPERATIONS];
  if (!definition) throw new AppError("INVALID_INPUT");
  const user = await currentUser(app);
  if (!user) throw new AppError("UNAUTHENTICATED");
  const output = await execute(definition, contextFor(user), input);
  if (definition.refresh) scope.postMessage({ kind: "changed" });
  return output;
}

function describe(error: unknown): RuntimeError {
  if (error instanceof ViewRedirect) return { code: REDIRECT_CODE, detail: { key: error.href } };
  if (isAppError(error)) return { code: error.code, detail: error.detail };
  console.error(error instanceof Error ? `${error.name}: ${error.message}\n${error.stack}` : String(error));
  return { code: "INTERNAL", detail: null };
}

scope.onmessage = async (event) => {
  const parsed = runtimeRequestSchema.safeParse(event.data);
  if (!parsed.success) return;
  const { id, operation, input } = parsed.data;
  try {
    const data = await handle(operation, input);
    scope.postMessage({ kind: "result", id, outcome: { ok: true, data } });
  } catch (error) {
    scope.postMessage({ kind: "result", id, outcome: { ok: false, error: describe(error) } });
  }
};

async function open(): Promise<void> {
  publish({ state: "opening" });
  const started = performance.now();
  const client = await PGlite.create(BROWSER_DATA_DIR);
  const opened = performance.now();
  const migrations = await pendingMigrations(drizzle(client));
  if (migrations.pending > 0 && !migrations.fresh) await backupBeforeMigration(client);
  await applyMigrations(drizzle(client));
  runtime = await buildRuntime(drizzle(client, { schema }));
  markReady();
  publish({
    state: "ready",
    openMs: Math.round(opened - started),
    migrateMs: Math.round(performance.now() - opened),
  });
  void drainJobs(runtime.app).catch(() => undefined);
}

publish({ state: "waiting" });
void navigator.locks.request(DATABASE_LOCK, async () => {
  try {
    await open();
  } catch (error) {
    publish({ state: "failed", reason: error instanceof Error ? error.message : "unknown" });
    return;
  }
  await new Promise<never>(() => undefined);
});
