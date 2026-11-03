import { assertAccountAdmin, type AccountActor } from "./account-actor";
import type { AccountRepository, AccountSummary } from "./ports";

export function makeListAccounts(deps: { accounts: AccountRepository }) {
  return async function listAccounts(input: { actor: AccountActor }): Promise<AccountSummary[]> {
    assertAccountAdmin(input.actor);
    return deps.accounts.listAccounts();
  };
}
