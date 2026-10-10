"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { CEFR_LEVELS } from "@/shared/levels";
import { AppError } from "@/shared/errors";
import { endSession, startSession } from "../session";
import { app, runAction, type ActionResult } from "./result";

const signInSchema = z.object({ email: z.string().max(200), password: z.string().max(200) });
const signUpSchema = z.object({
  name: z.string().max(80),
  email: z.string().max(200),
  password: z.string().max(200),
  level: z.enum(CEFR_LEVELS),
});

export async function signInAction(input: unknown): Promise<ActionResult<null>> {
  const result = await runAction("signIn", async () => {
    const parsed = signInSchema.safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_CREDENTIALS");
    const session = await app().signIn(parsed.data);
    await startSession(session.token, session.expiresAt);
    return null;
  });
  if (result.ok) redirect("/");
  return result;
}

export async function signUpAction(input: unknown): Promise<ActionResult<null>> {
  const result = await runAction("signUp", async () => {
    const parsed = signUpSchema.safeParse(input);
    if (!parsed.success) throw new AppError("INVALID_INPUT");
    await app().signUp(parsed.data);
    const session = await app().signIn({ email: parsed.data.email, password: parsed.data.password });
    await startSession(session.token, session.expiresAt);
    return null;
  });
  if (result.ok) redirect("/");
  return result;
}

export async function signOutAction(): Promise<void> {
  await app().signOut(await endSession());
  redirect("/login");
}
