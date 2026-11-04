import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import type { CefrLevel } from "@/shared/levels";
import type { Locale } from "@/shared/locales";
import { isStudyLanguage, type LanguagePair } from "@/shared/study-languages";
import { MIN_PASSWORD_LENGTH, defaultPreferences, normalizeEmail, pickAvatarColor } from "../domain/user";
import type {
  FirstAccountPolicy,
  FirstAccountProof,
  LanguagePairRepository,
  PasswordHasher,
  SetupCodeGate,
  UserRepository,
} from "./ports";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function makeSignUp(deps: {
  users: UserRepository;
  pairs: LanguagePairRepository;
  passwords: PasswordHasher;
  clock: Clock;
  ids: IdGenerator;
  firstAccount?: FirstAccountPolicy;
  setupCode?: SetupCodeGate;
}) {
  async function holdsSetupCode(proof: FirstAccountProof | undefined): Promise<boolean> {
    const gate = deps.setupCode;
    if (!gate) return false;
    const candidates = [proof?.cookieCode, proof?.typedCode].filter(
      (candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0,
    );
    for (const candidate of candidates) {
      if (await gate.matches(candidate)) return true;
    }
    return false;
  }

  async function guardFirstAccount(proof: FirstAccountProof | undefined): Promise<boolean> {
    if (deps.firstAccount !== "setup-code") return false;
    if (await deps.users.hasAccounts()) return false;
    if (!(await holdsSetupCode(proof))) throw new AppError("SETUP_CODE_INVALID");
    return true;
  }

  return async function signUp(input: {
    name: string;
    email: string;
    password: string;
    level: CefrLevel;
    locale?: Locale;
    pair?: LanguagePair;
    proof?: FirstAccountProof;
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
    const firstAccount = await guardFirstAccount(input.proof);
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
    if (firstAccount) await deps.setupCode?.consume();
    return { userId: id };
  };
}
