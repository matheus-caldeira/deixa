import { AppError } from "@/shared/errors";
import { assertAccountAdmin, type AccountActor } from "./account-actor";
import type { AccountRepository } from "./ports";

export function makeSetAccountAdmin(deps: { accounts: AccountRepository }) {
  return async function setAccountAdmin(input: {
    actor: AccountActor;
    accountId: string;
    isAdmin: boolean;
  }): Promise<void> {
    assertAccountAdmin(input.actor);
    const change = await deps.accounts.setAdmin(input.accountId, input.isAdmin);
    if (change === "not_found") throw new AppError("ACCOUNT_NOT_FOUND");
    if (change === "last_admin") throw new AppError("FORBIDDEN", "lastAdmin");
  };
}
