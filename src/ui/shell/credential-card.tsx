"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { removeCredentialAction, saveCredentialAction } from "@/app/actions/profile";
import {
  SECRET_KINDS,
  endpointSecret,
  type ServiceOverview,
  type StoredState,
} from "@/modules/ai-credentials";
import { KeyIcon } from "../icons";
import { useToast } from "./toast";

export function CredentialCard({ entry, scope }: { entry: ServiceOverview; scope: "user" | "global" }) {
  const t = useTranslations("credentials");
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const initial: StoredState = scope === "user" ? entry.own : (entry.global.stored ?? { state: "absent" });
  const [stored, setStored] = useState<StoredState>(initial);
  const [input, setInput] = useState("");
  const [endpointKey, setEndpointKey] = useState("");
  const isEndpoint = SECRET_KINDS[entry.service] === "endpoint";
  const secret = isEndpoint
    ? endpointSecret({ baseUrl: input.trim(), apiKey: endpointKey.trim() === "" ? null : endpointKey.trim() })
    : input;
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const guide = {
    use: t(`guide.${entry.service}.use`),
    where: t(`guide.${entry.service}.where`),
    placeholder: t(`guide.${entry.service}.placeholder`),
    without: t(`guide.${entry.service}.without`),
  };
  const name = scope === "global" ? t("globalName", { label: entry.label }) : entry.label;
  const fallbackNote =
    scope === "global"
      ? entry.global.source === "environment"
        ? t("globalFromEnv")
        : t("noGlobalKey", { without: guide.without })
      : entry.global.source
        ? t("usingGlobal")
        : t("noKey", { without: guide.without });

  const save = () => {
    setMessage({ text: t("testing"), error: false });
    startTransition(async () => {
      const result = await saveCredentialAction({ service: entry.service, scope, secret });
      if (!result.ok) {
        setMessage({ text: result.message, error: true });
        return;
      }
      setStored(result.data);
      setInput("");
      setEndpointKey("");
      setMessage(null);
      toast(isEndpoint ? t("endpointSaved") : t("keySaved"));
      router.refresh();
    });
  };

  const remove = () =>
    startTransition(async () => {
      const result = await removeCredentialAction({ service: entry.service, scope });
      if (!result.ok) {
        toast(result.message);
        return;
      }
      setStored({ state: "absent" });
      toast(t("removed"));
      router.refresh();
    });

  return (
    <div className="card col" style={{ gap: 10 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="row">
          <KeyIcon width={22} height={22} />
          <b>{entry.label}</b>
        </span>
        {stored.state === "ready" ? (
          <span className="chip good">{isEndpoint ? t("configured") : t("connected")}</span>
        ) : null}
        {stored.state === "unreadable" ? <span className="chip bad">{t("unreadable")}</span> : null}
      </div>
      {stored.state === "ready" ? (
        <>
          <span className="mono small">{stored.masked}</span>
          <button
            className="btn ghost"
            style={{ padding: 10, fontSize: 13 }}
            onClick={remove}
            disabled={pending}
            aria-label={t("removeLabel", { name })}
          >
            {isEndpoint ? t("removeEndpoint") : t("removeKey")}
          </button>
        </>
      ) : (
        <>
          <p className="small muted">
            {stored.state === "unreadable" ? t("unreadableBody") : `${guide.use} ${fallbackNote}`}
          </p>
          <div className="field">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={guide.placeholder}
              autoComplete="off"
              spellCheck={false}
              aria-label={isEndpoint ? t("endpointLabel", { name }) : t("keyLabel", { name })}
            />
          </div>
          {entry.service === "openai_compatible" ? (
            <div className="field">
              <input
                value={endpointKey}
                onChange={(event) => setEndpointKey(event.target.value)}
                placeholder={t("keyIfNeeded")}
                autoComplete="off"
                spellCheck={false}
                aria-label={t("keyLabel", { name })}
              />
            </div>
          ) : null}
          <span className="small muted">
            {isEndpoint ? t("learnMore") : t("whereToGet")}: {guide.where}
          </span>
          {message ? (
            <span className="small" style={{ color: message.error ? "var(--bad)" : "var(--muted)" }}>
              {message.text}
            </span>
          ) : null}
          <button
            className="btn"
            style={{ padding: 12, fontSize: 13 }}
            onClick={save}
            disabled={pending || input.trim() === ""}
            aria-label={t("testAndSaveLabel", { name })}
          >
            {t("testAndSave")}
          </button>
        </>
      )}
    </div>
  );
}
