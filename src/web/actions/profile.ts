import { preferencesSchema } from "@/operations/profile";
import { callAction } from "../call";
import { rememberLocale } from "../locale";

export async function updatePreferencesAction(input: unknown) {
  const result = await callAction("profile.updatePreferences", input);
  const locale = preferencesSchema.safeParse(input).data?.locale;
  if (result.ok && locale) rememberLocale(locale);
  return result;
}

export async function saveCredentialAction(input: unknown) {
  return callAction("profile.saveCredential", input);
}

export async function removeCredentialAction(input: unknown) {
  return callAction("profile.removeCredential", input);
}

export async function updateSettingsAction(input: unknown) {
  return callAction("profile.updateSettings", input);
}

export async function switchLanguagePairAction(input: unknown) {
  return callAction("profile.switchPair", input);
}

export async function addLanguagePairAction(input: unknown) {
  return callAction("profile.addPair", input);
}
