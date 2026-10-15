import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import type { CefrLevel } from "@/shared/levels";
import type { Locale } from "@/shared/locales";
import { isStudyLanguage, type LanguagePair } from "@/shared/study-languages";
import { MIN_PASSWORD_LENGTH, defaultPreferences, normalizeEmail, pickAvatarColor } from "../domain/user";
import type { LanguagePairRepository, PasswordHasher, UserRepository } from "./ports";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function makeSignUp(deps: {
  users: UserRepository;
  pairs: LanguagePairRepository;
  passwords: PasswordHasher;
  clock: Clock;
  ids: IdGenerator;
}) {
  return async function signUp(input: {
    name: string;
    email: string;
    password: string;
    level: CefrLevel;
    locale?: Locale;
    pair?: LanguagePair;
  }): Promise<{ userId: string }> {
    const name = input.name.trim();
    const email = normalizeEmail(input.email);
    if (name.length === 0 || !EMAIL_SHAPE.test(email) || input.password.length < MIN_PASSWORD_LENGTH) {
      throw new AppError("INVALID_INPUT");
    }
    if (
      input.pair &&
      (!isStudyLanguage(input.pair.target) ||
        !isStudyLanguage(input.pair.native) ||
        input.pair.target === input.pair.native)
    ) {
      throw new AppError("INVALID_INPUT");
    }
    if (await deps.users.findByEmail(email)) throw new AppError("EMAIL_TAKEN");
    const id = deps.ids.next();
    const preferences = defaultPreferences(input.level, input.locale, input.pair);
    await deps.users.create(
      {
        id,
        name,
        email,
        avatarColor: pickAvatarColor(email),
        passwordHash: await deps.passwords.hash(input.password),
      },
      preferences,
      deps.clock.now(),
    );
    await deps.pairs.upsertPair(
      id,
      { target: preferences.targetLanguage, native: preferences.nativeLanguage, level: input.level },
      deps.clock.now(),
    );
    return { userId: id };
  };
}
