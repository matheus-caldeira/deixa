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

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g;
const LINK_OR_MARKUP = /<|>|https?:|www\.|\[[^\]]*\]\(/i;

export function isPlainExplanationText(value: string): boolean {
  return !LINK_OR_MARKUP.test(value);
}

const plainText = (maxLength: number) =>
  z
    .string()
    .transform((value) => value.replace(CONTROL_CHARACTERS, " ").replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1).max(maxLength).refine(isPlainExplanationText, "texto com link ou marcação"));

export const explainedTermSchema = z.object({
  id: z.string().min(1),
  meaning: plainText(300),
  itemType: z.enum(ITEM_TYPES),
  difficulty: z.enum(CEFR_LEVELS),
  pronunciation: plainText(120).nullish(),
  exampleEnglish: plainText(240).nullish(),
  examplePortuguese: plainText(240).nullish(),
  lineTranslation: plainText(500).nullish(),
});

export const explainedTermsSchema = z.array(explainedTermSchema).max(MAX_HIGHLIGHTS_PER_BATCH);
export type ExplainedTerm = z.infer<typeof explainedTermSchema>;

export const translatedLinesSchema = z
  .array(z.object({ id: z.string().min(1), translation: plainText(500) }))
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
