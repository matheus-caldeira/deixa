"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import {
  connectDatabaseAction,
  embeddedDatabaseProgressAction,
  installEmbeddedDatabaseAction,
  unlockSetupAction,
} from "@/app/actions/setup";
import type { EmbeddedDatabasePhase as EmbeddedPhase } from "@/shared/embedded-database";
import { Logo } from "../shell/logo";
import { useErrorText } from "../shell/use-error-text";

export type SetupView = {
  unlocked: boolean;
  problem: string | null;
  fromEnvironment: boolean;
  codeFile: string;
  platform: "macos" | "windows" | "linux";
  detected: { host: string; port: number }[];
  embedded: "available" | "configured" | "unsupported";
};

type Choice = "embedded" | "existing" | null;
const PROGRESS_INTERVAL_MS = 1000;

function EmbeddedInstall({ onBack }: { onBack: () => void }) {
  const t = useTranslations("setup");
  const errorText = useErrorText();
  const phaseText = (phase: EmbeddedPhase): string => {
    switch (phase.phase) {
      case "downloading":
        return phase.percent === null
          ? t("phase.downloading")
          : t("phase.downloadingPercent", { percent: phase.percent });
      case "failed":
        return errorText(phase.reason);
      default:
        return t(`phase.${phase.phase}`);
    }
  };
  const router = useRouter();
  const [phase, setPhase] = useState<EmbeddedPhase>({ phase: "idle" });
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let active = true;
    const begin = async () => {
      const result = await installEmbeddedDatabaseAction();
      if (!active) return;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setStarted(true);
    };
    void begin();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!started) return;
    const timer = setInterval(async () => {
      const result = await embeddedDatabaseProgressAction();
      if (!result.ok) {
        setError(result.message);
        clearInterval(timer);
        return;
      }
      setPhase(result.data.phase);
      if (result.data.phase.phase === "failed") clearInterval(timer);
      if (result.data.next) {
        clearInterval(timer);
        router.push(result.data.next);
      }
    }, PROGRESS_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [started, router]);

  const failed = phase.phase === "failed" || error !== "";
  const percent = phase.phase === "downloading" ? (phase.percent ?? 0) : phase.phase === "idle" ? 0 : 100;
  return (
    <div className="col" style={{ gap: 12 }}>
      <p className="hint">
        <span>
          <b>{t("installing")}</b> {t("installingBody")}
        </span>
      </p>
      <div className="bar">
        <i style={{ width: `${Math.max(2, percent)}%` }} />
      </div>
      <p className={failed ? "formerr" : "small muted"} role="status">
        {error || phaseText(phase)}
      </p>
      {failed ? (
        <button type="button" className="btn ghost wide" onClick={onBack}>
          {t("back")}
        </button>
      ) : null}
    </div>
  );
}

const DEFAULT_PORT = 5432;
const DEFAULT_DATABASE = "deixa";

export function SetupScreen({ view }: { view: SetupView }) {
  const t = useTranslations("setup");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{
    key: string;
    params: Record<string, string | number>;
    next: string;
  } | null>(null);
  const [mode, setMode] = useState<"fields" | "url">("fields");
  const first = view.detected[0];
  const [host, setHost] = useState(first?.host ?? "localhost");
  const [port, setPort] = useState(String(first?.port ?? DEFAULT_PORT));
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState(DEFAULT_DATABASE);
  const [url, setUrl] = useState("");
  const [choice, setChoice] = useState<Choice>(view.embedded === "configured" ? "embedded" : null);
  const [selected, setSelected] = useState<Exclude<Choice, null>>("embedded");

  const unlock = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await unlockSetupAction(code);
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  };

  const connect = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await connectDatabaseAction(
        mode === "url" ? { mode, url } : { mode, host, port: Number(port), user, password, database },
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (result.data.notice) setNotice({ ...result.data.notice, next: result.data.next });
      else router.push(result.data.next);
    });
  };

  return (
    <div className="picker">
      <div className="col" style={{ gap: 10 }}>
        <Logo />
        <h1 style={{ fontSize: 24 }}>{t("title")}</h1>
        <p className="muted">{t("intro")}</p>
      </div>

      {view.problem ? (
        <div className="alertbar" role="status">
          <span>
            <b>{t("dbUnreachable")}</b> {t(`reasons.${view.problem}`)}
          </span>
          <button className="link small" onClick={() => router.refresh()}>
            {t("retry")}
          </button>
        </div>
      ) : null}

      {view.fromEnvironment ? (
        <p className="note">{t("fromEnvironment")}</p>
      ) : notice ? (
        <div className="col" style={{ gap: 12 }}>
          <p className="hint">
            <span>{t(`notices.${notice.key}`, notice.params)}</span>
          </p>
          <button className="btn wide" onClick={() => router.push(notice.next)}>
            {t("continue")}
          </button>
        </div>
      ) : !view.unlocked ? (
        <form className="col" style={{ gap: 12 }} onSubmit={unlock}>
          <p className="note">
            {t.rich("codeNote", { file: view.codeFile, b: (chunks) => <b>{chunks}</b> })}
          </p>
          <div className="field">
            <label htmlFor="setup-code">{t("setupCode")}</label>
            <input
              id="setup-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
            />
          </div>
          {error ? <p className="formerr">{error}</p> : null}
          <button className="btn wide" type="submit" disabled={pending}>
            {pending ? t("checking") : t("continue")}
          </button>
        </form>
      ) : view.embedded !== "unsupported" && choice === null ? (
        <div className="col" style={{ gap: 12 }}>
          <span className="eyebrow">{t("howToStore")}</span>
          <button
            type="button"
            className={`result ${selected === "embedded" ? "on" : ""}`}
            style={{ gridTemplateColumns: "1fr" }}
            onClick={() => setSelected("embedded")}
            aria-pressed={selected === "embedded"}
          >
            <span className="col" style={{ gap: 2 }}>
              <b>{t("embeddedOption")}</b>
              <span className="small muted">{t("embeddedOptionBody")}</span>
            </span>
          </button>
          <button
            type="button"
            className={`result ${selected === "existing" ? "on" : ""}`}
            style={{ gridTemplateColumns: "1fr" }}
            onClick={() => setSelected("existing")}
            aria-pressed={selected === "existing"}
          >
            <span className="col" style={{ gap: 2 }}>
              <b>{t("existingOption")}</b>
              <span className="small muted">{t("existingOptionBody")}</span>
            </span>
          </button>
          <button type="button" className="btn wide" onClick={() => setChoice(selected)}>
            {t("confirmChoice")}
          </button>
        </div>
      ) : choice === "embedded" ? (
        <EmbeddedInstall onBack={() => setChoice(null)} />
      ) : (
        <form className="col" style={{ gap: 12 }} onSubmit={connect}>
          {view.embedded !== "unsupported" ? (
            <button
              type="button"
              className="link small"
              style={{ alignSelf: "flex-start" }}
              onClick={() => setChoice(null)}
            >
              {t("backToChoice")}
            </button>
          ) : null}
          {view.detected.length > 0 ? (
            <div className="col" style={{ gap: 8 }}>
              <span className="eyebrow">{t("found")}</span>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {view.detected.map((server) => (
                  <button
                    key={server.port}
                    type="button"
                    className={`fchip ${mode === "fields" && port === String(server.port) ? "on" : ""}`}
                    onClick={() => {
                      setMode("fields");
                      setHost(server.host);
                      setPort(String(server.port));
                    }}
                  >
                    {server.host}:{server.port}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="col" style={{ gap: 8 }}>
              <p className="hint">
                <span>
                  <b>{t("notFound")}</b> {t(`guide.${view.platform}`)}
                </span>
              </p>
              <button type="button" className="btn ghost wide" onClick={() => router.refresh()}>
                {t("searchAgain")}
              </button>
            </div>
          )}

          <div className="seg">
            <button type="button" className={mode === "fields" ? "on" : ""} onClick={() => setMode("fields")}>
              {t("fillFields")}
            </button>
            <button type="button" className={mode === "url" ? "on" : ""} onClick={() => setMode("url")}>
              {t("pasteUrl")}
            </button>
          </div>

          {mode === "url" ? (
            <div className="field">
              <label htmlFor="setup-url">{t("connectionUrl")}</label>
              <input
                id="setup-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder={t("urlPlaceholder")}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </div>
          ) : (
            <>
              <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
                <div className="field" style={{ flex: 2 }}>
                  <label htmlFor="setup-host">{t("host")}</label>
                  <input
                    id="setup-host"
                    value={host}
                    onChange={(event) => setHost(event.target.value)}
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                  />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="setup-port">{t("port")}</label>
                  <input
                    id="setup-port"
                    value={port}
                    onChange={(event) => setPort(event.target.value)}
                    inputMode="numeric"
                    required
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="setup-user">{t("user")}</label>
                <input
                  id="setup-user"
                  value={user}
                  onChange={(event) => setUser(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="setup-password">{t("password")}</label>
                <input
                  id="setup-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="setup-database">{t("database")}</label>
                <input
                  id="setup-database"
                  value={database}
                  onChange={(event) => setDatabase(event.target.value)}
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </div>
            </>
          )}
          {error ? <p className="formerr">{error}</p> : null}
          <button className="btn wide" type="submit" disabled={pending}>
            {pending ? t("connecting") : t("testAndConnect")}
          </button>
          <p className="note">{t("storedLocallyNote")}</p>
        </form>
      )}
    </div>
  );
}
