import { createTranslator } from "next-intl";
import type { ActionResult } from "@/app/actions/result";
import type { OperationName, OperationOutput } from "@/operations/registry";
import type { AppErrorCode } from "@/shared/errors";
import { isLocale, DEFAULT_LOCALE } from "@/shared/locales";
import en from "../../locales/en.json";
import ptBR from "../../locales/pt-BR.json";
import { navigate } from "./navigation";
import type { RuntimeError } from "./protocol";
import { RuntimeCallError, runtime } from "./runtime-client";

const MESSAGES = { "pt-BR": ptBR, en };

export function currentLocale() {
  const lang = typeof document === "undefined" ? DEFAULT_LOCALE : document.documentElement.lang;
  return isLocale(lang) ? lang : DEFAULT_LOCALE;
}

export function describeError(error: RuntimeError): string {
  const locale = currentLocale();
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: "errors" });
  const translate = t as unknown as {
    (key: string, params?: Record<string, string | number>): string;
    has(key: string): boolean;
  };
  if (error.detail) {
    const key = `detail.${error.detail.key}`;
    if (translate.has(key)) return translate(key, error.detail.params);
  }
  return translate.has(error.code) ? translate(error.code) : translate("generic");
}

export function runtimeErrorOf(failure: unknown): RuntimeError {
  return failure instanceof RuntimeCallError ? failure.error : { code: "INTERNAL", detail: null };
}

export async function callAction<Name extends OperationName>(
  name: Name,
  input?: unknown,
): Promise<ActionResult<OperationOutput<Name>>> {
  try {
    return { ok: true, data: (await runtime().call(name, input)) as OperationOutput<Name> };
  } catch (failure) {
    const error = runtimeErrorOf(failure);
    if (error.code === "UNAUTHENTICATED") navigate("/login");
    return { ok: false, code: error.code as AppErrorCode, message: describeError(error) };
  }
}
