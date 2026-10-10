"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { signInAction } from "@/app/actions/auth";
import { APP_TAGLINE } from "@/shared/app";
import type { CefrLevel } from "@/shared/levels";
import { FlameIcon } from "../icons";
import { Logo } from "../shell/logo";

export type ShortcutProfile = {
  email: string;
  name: string;
  avatarColor: string;
  level: CefrLevel;
  tagline: string;
  streak: number;
};

export function LoginScreen({ profiles }: { profiles: ShortcutProfile[] }) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const selected = profiles.find((profile) => profile.email === email);

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
        <p className="muted">{APP_TAGLINE}</p>
      </div>
      {profiles.length > 0 ? (
        <div className="col" style={{ gap: 12 }}>
          <div className="eyebrow">Quem vai estudar agora?</div>
          {profiles.map((profile) => (
            <button
              key={profile.email}
              className="pcard"
              style={
                selected?.email === profile.email
                  ? { borderColor: "var(--brand)", boxShadow: "0 4px 0 var(--brand)" }
                  : undefined
              }
              onClick={() => {
                setEmail(profile.email);
                setError("");
              }}
            >
              <span className="avatar" style={{ background: profile.avatarColor }}>
                {profile.name.slice(0, 1)}
              </span>
              <span className="col" style={{ gap: 2, minWidth: 0 }}>
                <b style={{ fontSize: 17 }}>{profile.name}</b>
                <span className="small muted">{profile.tagline}</span>
              </span>
              <span className="col" style={{ alignItems: "flex-end", gap: 4 }}>
                <span className="lvlchip">{profile.level}</span>
                <span className="small muted" style={{ display: "flex", gap: 2, alignItems: "center" }}>
                  <FlameIcon width={16} height={16} />
                  {profile.streak}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <form className="col" style={{ gap: 12 }} onSubmit={submit}>
        <div className="field">
          <label htmlFor="login-email">E-mail</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">Senha</label>
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
          {pending ? "Entrando…" : selected ? `Entrar como ${selected.name}` : "Entrar"}
        </button>
        <Link className="link" style={{ alignSelf: "center" }} href="/signup">
          Criar conta
        </Link>
      </form>
      <p className="note">
        O catálogo é compartilhado entre as contas; sequência, XP, revisões e nível são individuais.
      </p>
    </div>
  );
}
