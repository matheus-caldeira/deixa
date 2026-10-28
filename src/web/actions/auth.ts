import type { ActionResult } from "@/app/actions/result";
import type { AppErrorCode } from "@/shared/errors";
import { isLocale } from "@/shared/locales";
import { currentLocale, describeError, runtimeErrorOf } from "../call";
import { rememberLocale } from "../locale";
import { navigate } from "../navigation";
import { runtime } from "../runtime-client";

type AuthOutcome = { user: { preferences: { locale: string } } | null };

async function authenticate(operation: string, input: unknown): Promise<ActionResult<null>> {
  try {
    const { user } = (await runtime().call(operation, input)) as AuthOutcome;
    const locale = user?.preferences.locale;
    if (isLocale(locale)) rememberLocale(locale);
    runtime().notifyChange();
    navigate("/");
    return { ok: true, data: null };
  } catch (failure) {
    const error = runtimeErrorOf(failure);
    return { ok: false, code: error.code as AppErrorCode, message: describeError(error) };
  }
}

export async function signInAction(input: unknown) {
  return authenticate("auth.signIn", input);
}

export async function signUpAction(input: unknown) {
  return authenticate("auth.signUp", { ...(input as object), locale: currentLocale() });
}

export async function signOutAction(): Promise<void> {
  await runtime().call("auth.signOut");
  runtime().notifyChange();
  navigate("/login");
}
