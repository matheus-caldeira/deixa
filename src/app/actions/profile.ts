"use server";

import { preferencesSchema } from "@/operations/profile";
import { runOperation } from "../operations";
import { rememberLocale } from "./locale";

export async function updatePreferencesAction(input: unknown) {
  const result = await runOperation("profile.updatePreferences", input);
  const locale = preferencesSchema.safeParse(input).data?.locale;
  if (result.ok && locale) await rememberLocale(locale);
  return result;
}

export async function saveCredentialAction(input: unknown) {
  return runOperation("profile.saveCredential", input);
}

export async function removeCredentialAction(input: unknown) {
  return runOperation("profile.removeCredential", input);
}

export async function updateSettingsAction(input: unknown) {
  return runOperation("profile.updateSettings", input);
}

export async function switchLanguagePairAction(input: unknown) {
  return runOperation("profile.switchPair", input);
}

export async function addLanguagePairAction(input: unknown) {
  return runOperation("profile.addPair", input);
}
