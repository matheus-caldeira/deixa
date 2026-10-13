"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { getContainer } from "@/infrastructure/container";
import {
  TESTED_MAJOR_VERSION,
  configureDatabase,
  embeddedDatabaseStatus,
  getDatabaseStatus,
  startEmbeddedDatabaseInstall,
  verifySetupCode,
  type EmbeddedPhase,
} from "@/infrastructure/setup";
import { SETUP_COOKIE } from "@/shared/session-cookie";
import type { ActionResult } from "./result";

const ALREADY_READY = "O banco já está configurado. Entre normalmente.";
const LOCKED = "Informe o código de configuração de novo.";
const ONE_HOUR_SECONDS = 3600;

const fieldsSchema = z.object({
  mode: z.literal("fields"),
  host: z
    .string()
    .trim()
    .regex(/^[a-z0-9]([a-z0-9.-]{0,198}[a-z0-9])?$/i),
  port: z.number().int().min(1).max(65_535),
  user: z.string().trim().min(1).max(100),
  password: z.string().max(200),
  database: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{1,60}$/),
});
const urlSchema = z.object({ mode: z.literal("url"), url: z.string().trim().min(1).max(600) });
const connectionSchema = z.discriminatedUnion("mode", [fieldsSchema, urlSchema]);

function toUrl(input: z.infer<typeof connectionSchema>): string {
  if (input.mode === "url") return input.url;
  const credentials = `${encodeURIComponent(input.user)}:${encodeURIComponent(input.password)}`;
  return `postgres://${credentials}@${input.host}:${input.port}/${input.database}`;
}

export async function unlockSetupAction(code: unknown): Promise<ActionResult<null>> {
  if ((await getDatabaseStatus()).state === "ready") return { ok: false, message: ALREADY_READY };
  const parsed = z.string().max(40).safeParse(code);
  if (!parsed.success || !(await verifySetupCode(parsed.data))) {
    return { ok: false, message: "Código incorreto. Confira o arquivo no computador onde o Deixa roda." };
  }
  (await cookies()).set(SETUP_COOKIE, parsed.data, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: ONE_HOUR_SECONDS,
  });
  return { ok: true, data: null };
}

export async function connectDatabaseAction(
  input: unknown,
): Promise<ActionResult<{ next: "/login" | "/signup"; notice: string | null }>> {
  const status = await getDatabaseStatus();
  if (status.state === "ready") return { ok: false, message: ALREADY_READY };
  const store = await cookies();
  if (!(await verifySetupCode(store.get(SETUP_COOKIE)?.value))) return { ok: false, message: LOCKED };
  const parsed = connectionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Confira os dados. O nome do banco aceita só letras minúsculas, números e sublinhado.",
    };
  }
  const result = await configureDatabase(toUrl(parsed.data));
  if (!result.ok) return result;
  store.delete(SETUP_COOKIE);
  const hasAccounts = (await getContainer().listPeople()).length > 0;
  const untested = result.majorVersion !== null && result.majorVersion < TESTED_MAJOR_VERSION;
  return {
    ok: true,
    data: {
      next: hasAccounts ? "/login" : "/signup",
      notice: untested
        ? `Conectado ao Postgres ${result.majorVersion}. O Deixa foi testado a partir do ${TESTED_MAJOR_VERSION}; se algo falhar, atualize o Postgres.`
        : null,
    },
  };
}

export async function installEmbeddedDatabaseAction(): Promise<ActionResult<null>> {
  if ((await getDatabaseStatus()).state === "ready") return { ok: false, message: ALREADY_READY };
  const store = await cookies();
  if (!(await verifySetupCode(store.get(SETUP_COOKIE)?.value))) return { ok: false, message: LOCKED };
  startEmbeddedDatabaseInstall();
  return { ok: true, data: null };
}

export async function embeddedDatabaseProgressAction(): Promise<
  ActionResult<{ phase: EmbeddedPhase; next: "/login" | "/signup" | null }>
> {
  const store = await cookies();
  const phase = embeddedDatabaseStatus();
  if (phase.phase === "ready" && (await getDatabaseStatus()).state === "ready") {
    store.delete(SETUP_COOKIE);
    const hasAccounts = (await getContainer().listPeople()).length > 0;
    return { ok: true, data: { phase, next: hasAccounts ? "/login" : "/signup" } };
  }
  if (!(await verifySetupCode(store.get(SETUP_COOKIE)?.value))) return { ok: false, message: LOCKED };
  return { ok: true, data: { phase: phase.phase === "ready" ? { phase: "starting" } : phase, next: null } };
}
