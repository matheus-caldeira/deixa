import { AppError, isAppError } from "@/shared/errors";
import type { LanguagePair } from "@/shared/study-languages";
import { translatedLinesSchema, type TranslationSource } from "../domain/learning";
import type { ResolveLlm } from "./ports";

export type CueForTranslation = {
  cueId: string;
  text: string;
  translation: string | null;
  translationSource: TranslationSource | null;
};

export function makeTranslateCue(deps: {
  findCueLine: (cueId: string, pair: LanguagePair) => Promise<CueForTranslation | null>;
  saveCueTranslation: (cueId: string, pair: LanguagePair, text: string) => Promise<void>;
  resolveLlm: ResolveLlm;
}) {
  return async function translateCue(input: {
    userId: string;
    cueId: string;
    pair: LanguagePair;
  }): Promise<{ text: string; source: TranslationSource }> {
    const line = await deps.findCueLine(input.cueId, input.pair);
    if (!line) throw new AppError("CUE_NOT_FOUND");
    if (line.translation && line.translationSource) {
      return { text: line.translation, source: line.translationSource };
    }
    const provider = await deps.resolveLlm(input.userId);
    let raw: unknown;
    try {
      raw = await provider.translateLines([{ id: line.cueId, text: line.text }], input.pair);
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError("LLM_FAILED");
    }
    const parsed = translatedLinesSchema.safeParse(raw);
    const translated = parsed.success ? parsed.data.find((entry) => entry.id === line.cueId) : undefined;
    if (!translated) throw new AppError("LLM_INVALID_OUTPUT");
    await deps.saveCueTranslation(line.cueId, input.pair, translated.translation);
    return { text: translated.translation, source: "llm" };
  };
}
