const MILLION = 1_000_000;
const THOUSAND = 1_000;

export function formatUsd(value: number): string {
  return `US$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatTokens(value: number): string {
  if (value >= MILLION)
    return `${(value / MILLION).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (value >= THOUSAND) return `${Math.round(value / THOUSAND)} mil`;
  return String(value);
}

export function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function parseDecimal(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) ? value : Number.NaN;
}

export function decimalText(value: number | null): string {
  return value === null
    ? ""
    : value.toLocaleString("pt-BR", { maximumFractionDigits: 6, useGrouping: false });
}
