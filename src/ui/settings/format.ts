"use client";

import { useFormatter, useLocale } from "next-intl";
import { useMemo } from "react";

const MILLION = 1_000_000;
const THOUSAND = 1_000;

export type UsageFormat = {
  usd: (value: number) => string;
  tokens: (value: number) => string;
  date: (value: Date | string) => string;
  decimal: (value: number | null) => string;
  parseDecimal: (text: string) => number | null;
  decimalSeparator: string;
};

export function useUsageFormat(): UsageFormat {
  const locale = useLocale();
  const format = useFormatter();
  return useMemo(() => {
    const decimalSeparator =
      new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === "decimal")?.value ?? ".";
    const groupSeparator =
      new Intl.NumberFormat(locale).formatToParts(1000).find((part) => part.type === "group")?.value ?? "";
    return {
      decimalSeparator,
      usd: (value) => `US$ ${format.number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      tokens: (value) => {
        if (value >= MILLION) return `${format.number(value / MILLION, { maximumFractionDigits: 1 })}M`;
        if (value >= THOUSAND) return `${Math.round(value / THOUSAND)}k`;
        return String(value);
      },
      date: (value) =>
        format.dateTime(new Date(value), { day: "2-digit", month: "2-digit", year: "numeric" }),
      decimal: (value) =>
        value === null ? "" : format.number(value, { maximumFractionDigits: 6, useGrouping: false }),
      parseDecimal: (text) => {
        const trimmed = text.trim();
        if (trimmed === "") return null;
        const normalized = (groupSeparator ? trimmed.split(groupSeparator).join("") : trimmed).replace(
          decimalSeparator,
          ".",
        );
        const value = Number(normalized);
        return Number.isFinite(value) ? value : Number.NaN;
      },
    };
  }, [format, locale]);
}
