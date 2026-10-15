import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, matchLocale, type Locale } from "@/shared/locales";
import { loadMessages } from "./messages";

export async function resolveRequestLocale(): Promise<Locale> {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(stored)) return stored;
  return matchLocale((await headers()).get("accept-language")) ?? DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveRequestLocale();
  return { locale, messages: await loadMessages(locale) };
});
