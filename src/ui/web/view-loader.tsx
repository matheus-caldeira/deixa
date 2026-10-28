"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { REDIRECT_CODE } from "@/operations/operation";
import type { OperationName, OperationOutput } from "@/operations/registry";
import { describeError, runtimeErrorOf } from "@/web/call";
import { navigate } from "@/web/navigation";
import { runtime } from "@/web/runtime-client";

type State<View> =
  | { kind: "loading" }
  | { kind: "ready"; view: View }
  | { kind: "missing" }
  | { kind: "failed"; message: string };

const MISSING = new Set([
  "MEDIA_NOT_FOUND",
  "EPISODE_NOT_FOUND",
  "SEASON_NOT_FOUND",
  "BATCH_NOT_FOUND",
  "INVALID_INPUT",
]);

function signedOutTarget() {
  return window.location.pathname === "/" ? "/welcome" : "/login";
}

export function useView<Name extends OperationName>(name: Name, input?: unknown) {
  const [state, setState] = useState<State<OperationOutput<Name>>>({ kind: "loading" });
  const key = JSON.stringify(input ?? null);
  useEffect(() => {
    let active = true;
    const load = () =>
      runtime()
        .call(name, JSON.parse(key) ?? undefined)
        .then(
          (view): State<OperationOutput<Name>> => ({ kind: "ready", view: view as OperationOutput<Name> }),
          (failure: unknown): State<OperationOutput<Name>> => {
            const error = runtimeErrorOf(failure);
            if (error.code === "UNAUTHENTICATED") navigate(signedOutTarget());
            if (error.code === REDIRECT_CODE && error.detail) navigate(error.detail.key);
            if (error.code === REDIRECT_CODE) return { kind: "loading" };
            if (MISSING.has(error.code)) return { kind: "missing" };
            return { kind: "failed", message: describeError(error) };
          },
        )
        .then((next) => {
          if (active) setState(next);
        });
    void load();
    const stop = runtime().onChange(() => void load());
    return () => {
      active = false;
      stop();
    };
  }, [name, key]);
  return state;
}

export function ViewLoader<Name extends OperationName>({
  name,
  input,
  children,
}: {
  name: Name;
  input?: unknown;
  children: (view: OperationOutput<Name>) => ReactNode;
}) {
  const t = useTranslations("web");
  const state = useView(name, input);
  if (state.kind === "loading") return <p className="muted small">{t("loading")}</p>;
  if (state.kind === "missing") return <p className="muted">{t("missing")}</p>;
  if (state.kind === "failed") return <p className="formerr">{state.message}</p>;
  return <>{children(state.view)}</>;
}
