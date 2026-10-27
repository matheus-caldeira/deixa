"use client";

import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, matchLocale, type Locale } from "@/shared/locales";
import en from "../../../locales/en.json";
import ptBR from "../../../locales/pt-BR.json";

const MESSAGES: Record<Locale, AbstractIntlMessages> = { "pt-BR": ptBR, en };

function subscribeToLanguages(onChange: () => void): () => void {
  window.addEventListener("languagechange", onChange);
  return () => window.removeEventListener("languagechange", onChange);
}

function browserLocale(): Locale {
  return matchLocale(navigator.languages.join(","));
}

export function WebProviders({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribeToLanguages, browserLocale, () => DEFAULT_LOCALE);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}
