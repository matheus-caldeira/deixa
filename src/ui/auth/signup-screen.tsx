"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { signUpAction } from "@/app/actions/auth";
import { CEFR_LEVELS, LEVEL_NAMES, type CefrLevel } from "@/shared/levels";
import { Logo } from "../shell/logo";

export function SignupScreen() {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [level, setLevel] = useState<CefrLevel>("A1");
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await signUpAction({ name, email, password, level });
      if (result && !result.ok) setError(result.message);
    });
  };

  return (
    <div className="picker">
      <div className="col" style={{ gap: 10 }}>
        <Logo />
        <p className="muted">Crie sua conta. Seu progresso, suas marcações e suas revisões são só seus.</p>
      </div>
      <form className="col" style={{ gap: 12 }} onSubmit={submit}>
        <div className="field">
          <label htmlFor="signup-name">Nome</label>
          <input
            id="signup-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="signup-email">E-mail</label>
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
          <label htmlFor="signup-password">Senha (mínimo de 8 caracteres)</label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="signup-level">Seu nível de inglês hoje</label>
          <select
            id="signup-level"
            value={level}
            onChange={(event) => setLevel(event.target.value as CefrLevel)}
          >
            {CEFR_LEVELS.map((option) => (
              <option key={option} value={option}>
                {option} · {LEVEL_NAMES[option]}
              </option>
            ))}
          </select>
        </div>
        {error ? <p className="formerr">{error}</p> : null}
        <button className="btn wide" type="submit" disabled={pending}>
          {pending ? "Criando…" : "Criar conta"}
        </button>
        <Link className="link" style={{ alignSelf: "center" }} href="/login">
          Já tenho conta
        </Link>
      </form>
    </div>
  );
}
