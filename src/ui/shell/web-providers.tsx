"use client";

import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, isLocale, matchLocale, type Locale } from "@/shared/locales";
import { onLocaleChange } from "@/web/locale";
import { setNavigator } from "@/web/navigation";
import en from "../../../locales/en.json";
import ptBR from "../../../locales/pt-BR.json";

const MESSAGES: Record<Locale, AbstractIntlMessages> = { "pt-BR": ptBR, en };
const LOCALE_KEY = "deixa-locale";

function storedLocale(): string | null {
  try {
    return window.localStorage.getItem(LOCALE_KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("languagechange", onChange);
  const stop = onLocaleChange((locale) => {
    try {
      window.localStorage.setItem(LOCALE_KEY, locale);
    } catch {}
    onChange();
  });
  return () => {
    window.removeEventListener("languagechange", onChange);
    stop();
  };
}

function browserLocale(): Locale {
  const stored = storedLocale();
  return isLocale(stored) ? stored : matchLocale(navigator.languages.join(","));
}

export function WebProviders({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const locale = useSyncExternalStore(subscribe, browserLocale, () => DEFAULT_LOCALE);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => setNavigator((href) => router.push(href)), [router]);
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="America/Sao_Paulo">
      {children}
    </NextIntlClientProvider>
  );
}
