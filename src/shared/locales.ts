import { z } from "zod";

export const LOCALES = ["pt-BR", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pt-BR";
export const LOCALE_COOKIE = "deixa_locale";
export const localeSchema = z.enum(LOCALES);

export const LOCALE_ENGLISH_NAMES: Record<Locale, string> = {
  "pt-BR": "Brazilian Portuguese",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function matchLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const wanted = acceptLanguage
    .split(",")
    .map((part) => part.trim().split(";")[0]?.toLowerCase() ?? "")
    .filter((tag) => tag.length > 0);
  for (const tag of wanted) {
    const exact = LOCALES.find((locale) => locale.toLowerCase() === tag);
    if (exact) return exact;
    const base = tag.split("-")[0];
    const byBase = LOCALES.find((locale) => locale.toLowerCase().split("-")[0] === base);
    if (byBase) return byBase;
  }
  return DEFAULT_LOCALE;
}
