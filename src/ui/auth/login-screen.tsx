"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { signInAction } from "@/app/actions/auth";
import { Logo } from "../shell/logo";

export function LoginScreen() {
  const t = useTranslations("auth");
  const tApp = useTranslations("app");
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await signInAction({ email, password });
      if (result && !result.ok) setError(result.message);
    });
  };

  return (
    <div className="picker">
      <div className="col" style={{ gap: 10 }}>
        <Logo />
        <p className="muted">{tApp("tagline")}</p>
      </div>
      <form className="col" style={{ gap: 12 }} onSubmit={submit}>
        <div className="field">
          <label htmlFor="login-email">{t("email")}</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">{t("password")}</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error ? <p className="formerr">{error}</p> : null}
        <button className="btn wide" type="submit" disabled={pending}>
          {pending ? t("signingIn") : t("signIn")}
        </button>
        <Link className="btn ghost wide" href="/signup">
          {t("createAccount")}
        </Link>
      </form>
      <p className="note">{t("sharedNote")}</p>
    </div>
  );
}
