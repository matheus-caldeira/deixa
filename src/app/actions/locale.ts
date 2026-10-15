import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "@/shared/locales";
import { MS_PER_DAY } from "@/shared/time";

const LOCALE_COOKIE_DAYS = 400;

export async function rememberLocale(locale: Locale): Promise<void> {
  (await cookies()).set(LOCALE_COOKIE, locale, {
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + LOCALE_COOKIE_DAYS * MS_PER_DAY),
  });
}

