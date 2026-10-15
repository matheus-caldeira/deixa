import { LOCALE_ENGLISH_NAMES, type Locale } from "@/shared/locales";

export type PromptLanguages = { locale: Locale };

const TARGET_LANGUAGE = "English";

export function languageNames(languages: PromptLanguages): { target: string; native: string } {
  return { target: TARGET_LANGUAGE, native: LOCALE_ENGLISH_NAMES[languages.locale] };
}
