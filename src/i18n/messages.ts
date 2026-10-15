import type { AbstractIntlMessages } from "next-intl";
import type { Locale } from "@/shared/locales";

const LOADERS: Record<Locale, () => Promise<{ default: AbstractIntlMessages }>> = {
  "pt-BR": () => import("../../locales/pt-BR.json"),
  en: () => import("../../locales/en.json"),
};

export async function loadMessages(locale: Locale): Promise<AbstractIntlMessages> {
  return (await LOADERS[locale]()).default;
}
