import { z } from "zod";
import type { Locale } from "./locales";

export const STUDY_LANGUAGES = ["en", "pt-BR", "es", "fr"] as const;
export type StudyLanguage = (typeof STUDY_LANGUAGES)[number];
export const studyLanguageSchema = z.enum(STUDY_LANGUAGES);

export type LanguagePair = { target: StudyLanguage; native: StudyLanguage };

export const DEFAULT_TARGET_LANGUAGE: StudyLanguage = "en";

export const LANGUAGE_ENGLISH_NAMES: Record<StudyLanguage, string> = {
  en: "English",
  "pt-BR": "Brazilian Portuguese",
  es: "Spanish",
  fr: "French",
};

export const LANGUAGE_TAGS: Record<StudyLanguage, string> = {
  en: "EN",
  "pt-BR": "PT",
  es: "ES",
  fr: "FR",
};

const NATIVE_BY_LOCALE: Record<Locale, StudyLanguage> = { "pt-BR": "pt-BR", en: "en" };

export function isStudyLanguage(value: unknown): value is StudyLanguage {
  return typeof value === "string" && (STUDY_LANGUAGES as readonly string[]).includes(value);
}

export function nativeLanguageFor(locale: Locale): StudyLanguage {
  return NATIVE_BY_LOCALE[locale];
}

export function defaultTargetFor(native: StudyLanguage): StudyLanguage {
  return native === "en" ? "es" : DEFAULT_TARGET_LANGUAGE;
}

export function pairKey(pair: LanguagePair): string {
  return `${pair.target}>${pair.native}`;
}

export function parsePairKey(key: string): LanguagePair | null {
  const [target, native] = key.split(">");
  return isStudyLanguage(target) && isStudyLanguage(native) && target !== native ? { target, native } : null;
}

export function samePair(a: LanguagePair, b: LanguagePair): boolean {
  return a.target === b.target && a.native === b.native;
}

export function normalizeLanguageTag(value: string): StudyLanguage | null {
  const lower = value.trim().toLowerCase();
  if (lower === "en" || lower.startsWith("en-")) return "en";
  if (lower === "pt" || lower === "pt-br" || lower === "pb" || lower === "por") return "pt-BR";
  if (lower === "es" || lower.startsWith("es-") || lower === "spa") return "es";
  if (lower === "fr" || lower.startsWith("fr-") || lower === "fre" || lower === "fra") return "fr";
  return null;
}
