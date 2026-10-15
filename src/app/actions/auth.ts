"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { CEFR_LEVELS } from "@/shared/levels";
import { AppError } from "@/shared/errors";
import { DEFAULT_LOCALE, isLocale } from "@/shared/locales";
import { getLocale } from "next-intl/server";
import { endSession, requireDatabase, startSession } from "../session";
import { rememberLocale } from "./locale";
import { app, runAction, type ActionResult } from "./result";

const signInSchema = z.object({ email: z.string().max(200), password: z.string().max(200) });
const signUpSchema = z.object({
  name: z.string().max(80),
  email: z.string().max(200),
  password: z.string().max(200),
  level: z.enum(CEFR_LEVELS),
});

export async function signInAction(input: unknown): Promise<ActionResult<null>> {
  await requireDatabase();
  const result = await runAction("signIn", async () => {
    const parsed = signInSchema.safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_CREDENTIALS");
    const throttleKey = parsed.data.email.trim().toLowerCase();
    const throttle = app().loginThrottle;
    if (throttle.isBlocked(throttleKey)) {
      throw new AppError("INVALID_CREDENTIALS", "tooManyAttempts");
    }
    try {
      const session = await app().signIn(parsed.data);
      throttle.reset(throttleKey);
      await startSession(session.token, session.expiresAt);
      const user = await app().getSessionUser(session.token);
      if (user) await rememberLocale(user.preferences.locale);
    } catch (error) {
      throttle.recordFailure(throttleKey);
      throw error;
    }
    return null;
  });
  if (result.ok) redirect("/");
  return result;
}

export async function signUpAction(input: unknown): Promise<ActionResult<null>> {
  await requireDatabase();
  const result = await runAction("signUp", async () => {
    const parsed = signUpSchema.safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    const locale = await getLocale();
    await app().signUp({ ...parsed.data, locale: isLocale(locale) ? locale : DEFAULT_LOCALE });
    const session = await app().signIn({ email: parsed.data.email, password: parsed.data.password });
    await startSession(session.token, session.expiresAt);
    return null;
  });
  if (result.ok) redirect("/");
  return result;
}

export async function signOutAction(): Promise<void> {
  await requireDatabase();
  await app().signOut(await endSession());
  redirect("/login");
}
