import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import { isCefrLevel, type CefrLevel } from "@/shared/levels";
import { isStudyLanguage, samePair, type LanguagePair } from "@/shared/study-languages";
import { pairOf, type UserLanguagePair } from "../domain/user";
import type { LanguagePairRepository, PreferencesRepository } from "./ports";

type Deps = { pairs: LanguagePairRepository; preferences: PreferencesRepository; clock: Clock };

function validPair(pair: LanguagePair): boolean {
  return isStudyLanguage(pair.target) && isStudyLanguage(pair.native) && pair.target !== pair.native;
}

export function makeListLanguagePairs(deps: Pick<Deps, "pairs" | "preferences">) {
  return async function listLanguagePairs(userId: string): Promise<UserLanguagePair[]> {
    const [pairs, preferences] = await Promise.all([
      deps.pairs.listPairs(userId),
      deps.preferences.get(userId),
    ]);
    const active = preferences ? pairOf(preferences) : null;
    return pairs.map((pair) => ({ ...pair, active: active !== null && samePair(pair, active) }));
  };
}

export function makeAddLanguagePair(deps: Deps) {
  return async function addLanguagePair(
    userId: string,
    input: LanguagePair & { level: CefrLevel },
  ): Promise<void> {
    if (!validPair(input) || !isCefrLevel(input.level)) throw new AppError("INVALID_INPUT");
    const existing = await deps.pairs.listPairs(userId);
    if (existing.some((pair) => samePair(pair, input))) throw new AppError("INVALID_INPUT", "pairExists");
    await deps.pairs.upsertPair(userId, input, deps.clock.now());
    await deps.preferences.update(userId, {
      targetLanguage: input.target,
      nativeLanguage: input.native,
      level: input.level,
    });
  };
}

export function makeSwitchLanguagePair(deps: Pick<Deps, "pairs" | "preferences">) {
  return async function switchLanguagePair(userId: string, pair: LanguagePair): Promise<void> {
    if (!validPair(pair)) throw new AppError("INVALID_INPUT");
    const stored = (await deps.pairs.listPairs(userId)).find((candidate) => samePair(candidate, pair));
    if (!stored) throw new AppError("INVALID_INPUT", "pairMissing");
    await deps.preferences.update(userId, {
      targetLanguage: stored.target,
      nativeLanguage: stored.native,
      level: stored.level,
    });
  };
}
