import { callAction } from "../call";

export async function listAccountsAction() {
  return callAction("accounts.list");
}

export async function createAccountAction(input: unknown) {
  return callAction("accounts.create", input);
}

export async function setAccountAdminAction(input: unknown) {
  return callAction("accounts.setAdmin", input);
}

export async function resetAccountPasswordAction(input: unknown) {
  return callAction("accounts.resetPassword", input);
}

export async function removeAccountAction(input: unknown) {
  return callAction("accounts.remove", input);
}
