"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

export function useErrorText(): (code: string | null | undefined) => string {
  const t = useTranslations("errors");
  return useCallback((code) => (code && t.has(code) ? t(code) : t("generic")), [t]);
}
