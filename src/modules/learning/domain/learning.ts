import { z } from "zod";
import { CEFR_LEVELS, type CefrLevel } from "@/shared/levels";

export const ITEM_TYPES = ["word", "expression", "phrasal_verb", "slang", "sentence"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];
export type Visibility = "global" | "private";
export type TranslationSource = "subtitle_pt" | "llm";
export type MarkKind = "word" | "phrase" | "line";
export type CardScope = "private" | "catalog";

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  word: "Palavra",
  expression: "Expressão",
  phrasal_verb: "Phrasal verb",
  slang: "Gíria",
  sentence: "Frase",
};

export const HIGHLIGHT_CARDS_XP = 10;
export const MAX_HIGHLIGHTS_PER_BATCH = 60;

const translationSource = z.enum(["subtitle_pt", "llm"]);

export const cardDraftSchema = z.object({
  key: z.string(),
  highlightId: z.string(),
  cueId: z.string(),
  startToken: z.number().int(),
  endToken: z.number().int(),
  kind: z.enum(["word", "phrase", "line"]),
  term: z.string(),
  itemType: z.enum(ITEM_TYPES),
  difficulty: z.enum(CEFR_LEVELS),
  meaning: z.string(),
  meaningSource: translationSource,
  pronunciation: z.string().nullable(),
  exampleEnglish: z.string().nullable(),
  examplePortuguese: z.string().nullable(),
  lineText: z.string(),
  lineTranslation: z.string().nullable(),
  lineTranslationSource: translationSource.nullable(),
  startMs: z.number().int(),
  endMs: z.number().int(),
  reusedItemId: z.string().nullable(),
});

export type CardDraft = z.infer<typeof cardDraftSchema>;

export const explainedTermSchema = z.object({
  id: z.string().min(1),
  meaning: z.string().trim().min(1).max(300),
  itemType: z.enum(ITEM_TYPES),
  difficulty: z.enum(CEFR_LEVELS),
  pronunciation: z.string().trim().max(120).nullish(),
  exampleEnglish: z.string().trim().max(240).nullish(),
  examplePortuguese: z.string().trim().max(240).nullish(),
  lineTranslation: z.string().trim().max(500).nullish(),
});

export const explainedTermsSchema = z.array(explainedTermSchema).max(MAX_HIGHLIGHTS_PER_BATCH);
export type ExplainedTerm = z.infer<typeof explainedTermSchema>;

export const translatedLinesSchema = z
  .array(z.object({ id: z.string().min(1), translation: z.string().trim().min(1).max(500) }))
  .max(MAX_HIGHLIGHTS_PER_BATCH);

export function spanKeyOf(span: { cueId: string; startToken: number; endToken: number }): string {
  return `${span.cueId}:${span.startToken}:${span.endToken}`;
}

export type ReusableItem = {
  id: string;
  cueId: string;
  startToken: number;
  endToken: number;
  visibility: Visibility;
  ownerUserId: string | null;
  term: string;
  itemType: ItemType;
  difficulty: CefrLevel;
  meaning: string;
  meaningSource: TranslationSource;
  pronunciation: string | null;
  exampleEnglish: string | null;
  examplePortuguese: string | null;
  lineTranslation: string | null;
  lineTranslationSource: TranslationSource | null;
};
