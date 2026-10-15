import { pingDatabase, refreshSettings, resolveDatabaseUrl } from "../container";
import { ensureEmbeddedPostgres } from "../embedded-postgres";
import { runMigrations } from "../database/migrate";
import { describeConnectionError, type ConnectionFailure } from "./database-probe";

export type DatabaseStatus =
  { state: "ready" } | { state: "unconfigured" } | { state: "unreachable"; reason: ConnectionFailure };

const READY_FOR_MS = 15_000;
const FAILED_FOR_MS = 3000;

type Checked = { url: string; status: DatabaseStatus; until: number };
let last: Checked | undefined;
let running: { url: string; check: Promise<DatabaseStatus> } | undefined;
let migratedUrl: string | undefined;

async function check(url: string): Promise<DatabaseStatus> {
  try {
    await ensureEmbeddedPostgres();
    if (migratedUrl !== url) {
      await runMigrations(url);
      migratedUrl = url;
    }
    await pingDatabase(url);
    await refreshSettings();
    return { state: "ready" };
  } catch (error) {
    return { state: "unreachable", reason: describeConnectionError(error) };
  }
}

export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  const url = resolveDatabaseUrl();
  if (!url) return { state: "unconfigured" };
  const now = Date.now();
  if (last && last.url === url && now < last.until) return last.status;
  if (running?.url !== url) {
    const started = check(url).finally(() => {
      if (running?.check === started) running = undefined;
    });
    running = { url, check: started };
  }
  const status = await running.check;
  last = { url, status, until: Date.now() + (status.state === "ready" ? READY_FOR_MS : FAILED_FOR_MS) };
  return status;
}

export function forgetDatabaseStatus(): void {
  last = undefined;
}
