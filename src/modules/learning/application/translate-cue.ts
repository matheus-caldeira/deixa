import { AppError, isAppError } from "@/shared/errors";
import { translatedLinesSchema, type TranslationSource } from "../domain/learning";
import type { ResolveLlm } from "./ports";

export type CueForTranslation = {
  cueId: string;
  text: string;
  translation: string | null;
  translationSource: TranslationSource | null;
};

export function makeTranslateCue(deps: {
  findCueLine: (cueId: string) => Promise<CueForTranslation | null>;
  saveCueTranslation: (cueId: string, text: string) => Promise<void>;
  resolveLlm: ResolveLlm;
}) {
  return async function translateCue(input: {
    userId: string;
    cueId: string;
  }): Promise<{ text: string; source: TranslationSource }> {
    const line = await deps.findCueLine(input.cueId);
    if (!line) throw new AppError("CUE_NOT_FOUND");
    if (line.translation && line.translationSource) {
      return { text: line.translation, source: line.translationSource };
    }
    const provider = await deps.resolveLlm(input.userId);
    let raw: unknown;
    try {
      raw = await provider.translateLines([{ id: line.cueId, text: line.text }]);
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError("LLM_FAILED", "A IA não respondeu. Tente de novo em instantes.");
    }
    const parsed = translatedLinesSchema.safeParse(raw);
    const translated = parsed.success ? parsed.data.find((entry) => entry.id === line.cueId) : undefined;
    if (!translated) throw new AppError("LLM_INVALID_OUTPUT", "A IA devolveu uma resposta fora do formato.");
    await deps.saveCueTranslation(line.cueId, translated.translation);
    return { text: translated.translation, source: "llm" };
  };
}
