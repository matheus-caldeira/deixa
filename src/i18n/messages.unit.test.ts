import { describe, expect, it } from "vitest";
import { LOCALES } from "@/shared/locales";
import { loadMessages } from "./messages";

type Tree = Record<string, unknown>;

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") entries.set(path, value);
    else if (value && typeof value === "object") {
      for (const [nested, text] of flatten(value as Tree, path)) entries.set(nested, text);
    }
  }
  return entries;
}

const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{(\w+)/g)].map((match) => match[1] ?? "").sort();

describe("mensagens da interface", () => {
  it("todos os idiomas têm as mesmas chaves, com os mesmos parâmetros", async () => {
    const [reference, ...others] = await Promise.all(
      LOCALES.map(async (locale) => ({ locale, entries: flatten((await loadMessages(locale)) as Tree) })),
    );
    expect(reference).toBeDefined();
    for (const other of others) {
      const missing = [...reference!.entries.keys()].filter((key) => !other.entries.has(key));
      const extra = [...other.entries.keys()].filter((key) => !reference!.entries.has(key));
      expect({ locale: other.locale, missing, extra }).toEqual({
        locale: other.locale,
        missing: [],
        extra: [],
      });
      for (const [key, text] of reference!.entries) {
        expect({ key, params: placeholders(other.entries.get(key) ?? "") }).toEqual({
          key,
          params: placeholders(text),
        });
      }
    }
  });

  it("nenhuma mensagem fica vazia", async () => {
    for (const locale of LOCALES) {
      const empty = [...flatten((await loadMessages(locale)) as Tree)].filter(
        ([, text]) => text.trim() === "",
      );
      expect(empty).toEqual([]);
    }
  });
});
