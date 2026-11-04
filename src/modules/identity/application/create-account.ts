import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import type { CefrLevel } from "@/shared/levels";
import type { Locale } from "@/shared/locales";
import { assertAccountAdmin, type AccountActor } from "./account-actor";
import type { LanguagePairRepository, PasswordHasher, UserRepository } from "./ports";
import { makeSignUp } from "./sign-up";

export function makeCreateAccount(deps: {
  users: UserRepository;
  pairs: LanguagePairRepository;
  passwords: PasswordHasher;
  clock: Clock;
  ids: IdGenerator;
}) {
  const signUp = makeSignUp(deps);
  return async function createAccount(input: {
    actor: AccountActor;
    name: string;
    email: string;
    password: string;
    level: CefrLevel;
    locale: Locale;
  }): Promise<{ accountId: string }> {
    assertAccountAdmin(input.actor);
    const { userId } = await signUp({
      name: input.name,
      email: input.email,
      password: input.password,
      level: input.level,
      locale: input.locale,
    });
    return { accountId: userId };
  };
}
