"use server";

import { runOperation } from "../operations";

export async function listAccountsAction() {
  return runOperation("accounts.list");
}

export async function createAccountAction(input: unknown) {
  return runOperation("accounts.create", input);
}

export async function setAccountAdminAction(input: unknown) {
  return runOperation("accounts.setAdmin", input);
}

export async function resetAccountPasswordAction(input: unknown) {
  return runOperation("accounts.resetPassword", input);
}

export async function removeAccountAction(input: unknown) {
  return runOperation("accounts.remove", input);
}
