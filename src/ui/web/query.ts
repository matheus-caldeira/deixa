"use client";

import { useSearchParams } from "next/navigation";

export function useQueryInput(keys: string[]): Record<string, string> {
  const params = useSearchParams();
  const input: Record<string, string> = {};
  for (const key of keys) {
    const value = params.get(key);
    if (value !== null) input[key] = value;
  }
  return input;
}
