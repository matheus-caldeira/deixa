"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { signUpAction } from "@/app/actions/auth";
import { MIN_PASSWORD_LENGTH } from "@/modules/identity";
import { CEFR_LEVELS, type CefrLevel } from "@/shared/levels";
import {
  STUDY_LANGUAGES,
  defaultTargetFor,
  nativeLanguageFor,
  type StudyLanguage,
} from "@/shared/study-languages";
import { Logo } from "../shell/logo";

export function SignupScreen({ setupCodeFile = null }: { setupCodeFile?: string | null }) {
  const t = useTranslations("auth");
  const levels = useTranslations("levels");
  const languages = useTranslations("languages");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [level, setLevel] = useState<CefrLevel>("A1");
  const [nativeLanguage, setNativeLanguage] = useState<StudyLanguage>(() =>
    nativeLanguageFor(locale === "en" ? "en" : "pt-BR"),
  );
  const [targetLanguage, setTargetLanguage] = useState<StudyLanguage>(() =>
    defaultTargetFor(nativeLanguageFor(locale === "en" ? "en" : "pt-BR")),
  );
  const [setupCode, setSetupCode] = useState("");
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await signUpAction({
        name,
        email,
        password,
        level,
        nativeLanguage,
        targetLanguage,
        ...(setupCodeFile ? { setupCode } : {}),
      });
      if (result && !result.ok) setError(result.message);
    });
  };

  return (
    <div className="picker">
      <div className="col" style={{ gap: 10 }}>
        <Logo />
        <p className="muted">{t("signupIntro")}</p>
      </div>
      <form className="col" style={{ gap: 12 }} onSubmit={submit}>
        {setupCodeFile ? (
          <div className="field">
            <label htmlFor="signup-setup-code">{t("setupCode")}</label>
            <input
              id="signup-setup-code"
              value={setupCode}
              onChange={(event) => setSetupCode(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              maxLength={40}
              required
            />
            <p className="muted">{t("setupCodeHint", { file: setupCodeFile })}</p>
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="signup-name">{t("name")}</label>
          <input
            id="signup-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="signup-email">{t("email")}</label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="signup-password">{t("passwordMin", { min: MIN_PASSWORD_LENGTH })}</label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </div>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="signup-native">{t("nativeLanguage")}</label>
            <select
              id="signup-native"
              value={nativeLanguage}
              onChange={(event) => {
                const next = event.target.value as StudyLanguage;
                setNativeLanguage(next);
                if (next === targetLanguage) setTargetLanguage(defaultTargetFor(next));
              }}
            >
              {STUDY_LANGUAGES.map((option) => (
                <option key={option} value={option}>
                  {languages(option)}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="signup-target">{t("targetLanguage")}</label>
            <select
              id="signup-target"
              value={targetLanguage}
              onChange={(event) => setTargetLanguage(event.target.value as StudyLanguage)}
            >
              {STUDY_LANGUAGES.filter((option) => option !== nativeLanguage).map((option) => (
                <option key={option} value={option}>
                  {languages(option)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="signup-level">{t("levelToday", { language: languages(targetLanguage) })}</label>
          <select
            id="signup-level"
            value={level}
            onChange={(event) => setLevel(event.target.value as CefrLevel)}
          >
            {CEFR_LEVELS.map((option) => (
              <option key={option} value={option}>
                {option} · {levels(option)}
              </option>
            ))}
          </select>
        </div>
        {error ? <p className="formerr">{error}</p> : null}
        <button className="btn wide" type="submit" disabled={pending}>
          {pending ? t("creating") : t("createAccount")}
        </button>
        <Link className="link" style={{ alignSelf: "center" }} href="/login">
          {t("haveAccount")}
        </Link>
      </form>
    </div>
  );
}
