import { rm } from "node:fs/promises";
import postgres from "postgres";
import { e2eEnvironment } from "../e2e/environment";
import { DESKTOP_DATABASE, DESKTOP_HOME } from "./environment";

async function prepare(): Promise<void> {
  const base = e2eEnvironment().DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL ausente para o teste do pacote.");
  const admin = new URL(base);
  admin.pathname = "/postgres";
  const client = postgres(admin.toString(), { max: 1, onnotice: () => undefined });
  try {
    await client.unsafe(`DROP DATABASE IF EXISTS ${DESKTOP_DATABASE} WITH (FORCE)`);
  } finally {
    await client.end({ timeout: 5 });
  }
  await rm(DESKTOP_HOME, { recursive: true, force: true });
}

prepare().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "falha ao preparar o teste do pacote");
  process.exit(1);
});
