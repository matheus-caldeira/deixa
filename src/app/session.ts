import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getContainer } from "@/infrastructure/container";
import type { SessionUser } from "@/modules/identity";
import { SESSION_COOKIE } from "@/shared/session-cookie";

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getContainer().getSessionUser(token);
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function startSession(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getContainer().secureSessionCookie,
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<string | undefined> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  return token;
}
