import type { Locale } from "@/shared/locales";

type Listener = (locale: Locale) => void;

const listeners = new Set<Listener>();

export function rememberLocale(locale: Locale) {
  for (const listener of listeners) listener(locale);
}

export function onLocaleChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
