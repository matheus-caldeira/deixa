import type { Locale } from "@/shared/locales";
import { LANGUAGE_ENGLISH_NAMES, type LanguagePair } from "@/shared/study-languages";

export type PromptLanguages = { locale: Locale; pair: LanguagePair };

export function languageNames(languages: PromptLanguages): { target: string; native: string } {
  return {
    target: LANGUAGE_ENGLISH_NAMES[languages.pair.target],
    native: LANGUAGE_ENGLISH_NAMES[languages.pair.native],
  };
}
