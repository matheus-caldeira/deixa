"use server";

import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { getContainer } from "@/infrastructure/container";
import {
  TESTED_MAJOR_VERSION,
  configureDatabase,
  embeddedDatabaseStatus,
  finishSetup,
  getDatabaseStatus,
  startEmbeddedDatabaseInstall,
  verifySetupCode,
  type EmbeddedPhase,
} from "@/infrastructure/setup";
import { SETUP_COOKIE } from "@/shared/session-cookie";
import type { ActionResult } from "./result";

const ONE_HOUR_SECONDS = 3600;

type SetupMessage = "alreadyReady" | "locked" | "wrongCode" | "invalidFields";
type SetupNotice = { key: "untestedVersion"; params: Record<string, string | number> };

async function fail(key: SetupMessage): Promise<{ ok: false; message: string }> {
  const t = await getTranslations("setup.messages");
  return { ok: false, message: t(key) };
}

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
  if ((await getDatabaseStatus()).state === "ready") return fail("alreadyReady");
  const parsed = z.string().max(40).safeParse(code);
  if (!parsed.success || !(await verifySetupCode(parsed.data))) return fail("wrongCode");
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
): Promise<ActionResult<{ next: "/login" | "/signup"; notice: SetupNotice | null }>> {
  const status = await getDatabaseStatus();
  if (status.state === "ready") return fail("alreadyReady");
  const store = await cookies();
  if (!(await verifySetupCode(store.get(SETUP_COOKIE)?.value))) return fail("locked");
  const parsed = connectionSchema.safeParse(input);
  if (!parsed.success) return fail("invalidFields");
  const result = await configureDatabase(toUrl(parsed.data));
  if (!result.ok) {
    const t = await getTranslations("setup.reasons");
    return { ok: false, message: t(result.failure) };
  }
  store.delete(SETUP_COOKIE);
  const hasAccounts = (await getContainer().listPeople()).length > 0;
  const untested = result.majorVersion !== null && result.majorVersion < TESTED_MAJOR_VERSION;
  return {
    ok: true,
    data: {
      next: hasAccounts ? "/login" : "/signup",
      notice: untested
        ? {
            key: "untestedVersion",
            params: { version: result.majorVersion ?? 0, tested: TESTED_MAJOR_VERSION },
          }
        : null,
    },
  };
}

export async function installEmbeddedDatabaseAction(): Promise<ActionResult<null>> {
  if ((await getDatabaseStatus()).state === "ready") return fail("alreadyReady");
  const store = await cookies();
  if (!(await verifySetupCode(store.get(SETUP_COOKIE)?.value))) return fail("locked");
  startEmbeddedDatabaseInstall();
  return { ok: true, data: null };
}

export async function embeddedDatabaseProgressAction(): Promise<
  ActionResult<{ phase: EmbeddedPhase; next: "/login" | "/signup" | null }>
> {
  const store = await cookies();
  if (!(await verifySetupCode(store.get(SETUP_COOKIE)?.value))) return fail("locked");
  const phase = embeddedDatabaseStatus();
  if (phase.phase !== "ready") return { ok: true, data: { phase, next: null } };
  if ((await getDatabaseStatus()).state !== "ready") {
    return { ok: true, data: { phase: { phase: "starting" }, next: null } };
  }
  finishSetup();
  store.delete(SETUP_COOKIE);
  const hasAccounts = (await getContainer().listPeople()).length > 0;
  return { ok: true, data: { phase, next: hasAccounts ? "/login" : "/signup" } };
}
