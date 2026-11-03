import { AppError } from "@/shared/errors";
import { assertAccountAdmin, type AccountActor } from "./account-actor";
import type { AccountRepository } from "./ports";

export function makeRemoveAccount(deps: { accounts: AccountRepository }) {
  return async function removeAccount(input: { actor: AccountActor; accountId: string }): Promise<void> {
    assertAccountAdmin(input.actor);
    if (input.accountId === input.actor.userId) throw new AppError("FORBIDDEN", "cannotRemoveSelf");
    const removal = await deps.accounts.removeAccount(input.accountId);
    if (removal === "not_found") throw new AppError("ACCOUNT_NOT_FOUND");
    if (removal === "last_admin") throw new AppError("FORBIDDEN", "lastAdmin");
  };
}
