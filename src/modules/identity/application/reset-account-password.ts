import { AppError } from "@/shared/errors";
import { MIN_PASSWORD_LENGTH } from "../domain/user";
import { assertAccountAdmin, type AccountActor } from "./account-actor";
import type { AccountRepository, PasswordHasher } from "./ports";

export function makeResetAccountPassword(deps: { accounts: AccountRepository; passwords: PasswordHasher }) {
  return async function resetAccountPassword(input: {
    actor: AccountActor;
    accountId: string;
    password: string;
  }): Promise<void> {
    assertAccountAdmin(input.actor);
    if (input.password.length < MIN_PASSWORD_LENGTH) throw new AppError("INVALID_INPUT");
    const replaced = await deps.accounts.replacePassword(
      input.accountId,
      await deps.passwords.hash(input.password),
    );
    if (!replaced) throw new AppError("ACCOUNT_NOT_FOUND");
  };
}
