import { PGlite } from "@electric-sql/pglite";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { applyMigrations } from "@/infrastructure/database/apply-migrations";
import type { Database } from "@/infrastructure/database/client";
import * as schema from "@/infrastructure/database/schema";
import { isAppError } from "@/shared/errors";
import {
  BROWSER_DATA_DIR,
  DATABASE_LOCK,
  runtimeRequestSchema,
  type RuntimeMessage,
  type RuntimeStatus,
} from "./protocol";

type Operation = (db: Database, input: unknown) => Promise<unknown>;

const OPERATIONS: Record<string, Operation> = {
  "lab.probe": async (db) => {
    const [row] = await db.select({ total: count() }).from(schema.users);
    const estimate = await navigator.storage.estimate();
    return { users: row?.total ?? 0, usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
  },
  "lab.addUser": async (db) => {
    const id = crypto.randomUUID();
    await db.insert(schema.users).values({
      id,
      name: "Prova",
      email: `${id}@deixa.local`,
      passwordHash: "-",
      avatarColor: "#5B5BD6",
      createdAt: new Date(),
    });
    return { id };
  },
};

const scope = globalThis as unknown as {
  postMessage: (message: RuntimeMessage) => void;
  onmessage: ((event: MessageEvent) => void) | null;
};

let database: Database | null = null;
let status: RuntimeStatus = { state: "waiting" };

function publish(next: RuntimeStatus) {
  status = next;
  scope.postMessage({ kind: "status", status });
}

async function openDatabase(): Promise<void> {
  publish({ state: "opening" });
  const started = performance.now();
  const client = await PGlite.create(BROWSER_DATA_DIR);
  const opened = performance.now();
  await applyMigrations(drizzle(client));
  database = drizzle(client, { schema });
  publish({
    state: "ready",
    openMs: Math.round(opened - started),
    migrateMs: Math.round(performance.now() - opened),
  });
}

scope.onmessage = async (event) => {
  const parsed = runtimeRequestSchema.safeParse(event.data);
  if (!parsed.success) return;
  const { id, operation, input } = parsed.data;
  const run = OPERATIONS[operation];
  if (!database || !run) {
    scope.postMessage({ kind: "result", id, outcome: { ok: false, code: "UNAVAILABLE" } });
    return;
  }
  try {
    const data = await run(database, input);
    scope.postMessage({ kind: "result", id, outcome: { ok: true, data } });
  } catch (error) {
    const code = isAppError(error) ? error.code : "INTERNAL";
    scope.postMessage({ kind: "result", id, outcome: { ok: false, code } });
  }
};

publish(status);
void navigator.locks.request(DATABASE_LOCK, async () => {
  try {
    await openDatabase();
  } catch (error) {
    publish({ state: "failed", reason: error instanceof Error ? error.message : "unknown" });
    return;
  }
  await new Promise<never>(() => undefined);
});
