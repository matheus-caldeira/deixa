"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { connectDatabaseAction, unlockSetupAction } from "@/app/actions/setup";
import { Logo } from "../shell/logo";

export type SetupView = {
  unlocked: boolean;
  problem: string | null;
  fromEnvironment: boolean;
  codeFile: string;
  platform: "macos" | "windows" | "linux";
  detected: { host: string; port: number }[];
};

const INSTALL_GUIDE: Record<SetupView["platform"], { name: string; steps: string }> = {
  macos: {
    name: "Postgres.app (postgresapp.com)",
    steps:
      "Baixe, arraste para Aplicativos, abra e clique em Initialize. O usuário é o seu nome de usuário do Mac, sem senha.",
  },
  windows: {
    name: "instalador oficial (postgresql.org/download/windows)",
    steps: "Durante a instalação, anote a senha que você definir para o usuário postgres.",
  },
  linux: {
    name: "pacote da sua distribuição (por exemplo, sudo apt install postgresql)",
    steps: "Depois crie um usuário com senha: sudo -u postgres createuser --pwprompt --createdb deixa.",
  },
};
const DEFAULT_PORT = 5432;
const DEFAULT_DATABASE = "deixa";

export function SetupScreen({ view }: { view: SetupView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ text: string; next: string } | null>(null);
  const [mode, setMode] = useState<"fields" | "url">("fields");
  const first = view.detected[0];
  const [host, setHost] = useState(first?.host ?? "localhost");
  const [port, setPort] = useState(String(first?.port ?? DEFAULT_PORT));
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState(DEFAULT_DATABASE);
  const [url, setUrl] = useState("");
  const guide = INSTALL_GUIDE[view.platform];

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
      if (result.data.notice) setNotice({ text: result.data.notice, next: result.data.next });
      else router.push(result.data.next);
    });
  };

  return (
    <div className="picker">
      <div className="col" style={{ gap: 10 }}>
        <Logo />
        <h1 style={{ fontSize: 24 }}>Configurar o banco de dados</h1>
        <p className="muted">
          O Deixa guarda catálogo, legendas e progresso num banco PostgreSQL que fica no seu computador ou em
          outro servidor seu.
        </p>
      </div>

      {view.problem ? (
        <div className="alertbar" role="status">
          <span>
            <b>O banco configurado não respondeu.</b> {view.problem}
          </span>
          <button className="link small" onClick={() => router.refresh()}>
            Tentar de novo
          </button>
        </div>
      ) : null}

      {view.fromEnvironment ? (
        <p className="note">
          A conexão deste servidor vem da variável DATABASE_URL. Corrija o valor lá e reinicie o Deixa.
        </p>
      ) : notice ? (
        <div className="col" style={{ gap: 12 }}>
          <p className="hint">
            <span>{notice.text}</span>
          </p>
          <button className="btn wide" onClick={() => router.push(notice.next)}>
            Continuar
          </button>
        </div>
      ) : !view.unlocked ? (
        <form className="col" style={{ gap: 12 }} onSubmit={unlock}>
          <p className="note">
            Para garantir que é você, abra o arquivo <b>{view.codeFile}</b> na pasta onde o Deixa está
            instalado e digite o código que está nele.
          </p>
          <div className="field">
            <label htmlFor="setup-code">Código de configuração</label>
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
            {pending ? "Conferindo…" : "Continuar"}
          </button>
        </form>
      ) : (
        <form className="col" style={{ gap: 12 }} onSubmit={connect}>
          {view.detected.length > 0 ? (
            <div className="col" style={{ gap: 8 }}>
              <span className="eyebrow">Postgres encontrado neste computador</span>
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
                  <b>Nenhum Postgres encontrado neste computador.</b> Recomendamos instalar o {guide.name}.{" "}
                  {guide.steps}
                </span>
              </p>
              <button type="button" className="btn ghost wide" onClick={() => router.refresh()}>
                Já instalei: procurar de novo
              </button>
            </div>
          )}

          <div className="seg">
            <button type="button" className={mode === "fields" ? "on" : ""} onClick={() => setMode("fields")}>
              Preencher os dados
            </button>
            <button type="button" className={mode === "url" ? "on" : ""} onClick={() => setMode("url")}>
              Colar o endereço
            </button>
          </div>

          {mode === "url" ? (
            <div className="field">
              <label htmlFor="setup-url">Endereço de conexão</label>
              <input
                id="setup-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="postgres://usuario:senha@servidor:5432/deixa"
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
                  <label htmlFor="setup-host">Servidor</label>
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
                  <label htmlFor="setup-port">Porta</label>
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
                <label htmlFor="setup-user">Usuário do Postgres</label>
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
                <label htmlFor="setup-password">Senha do Postgres</label>
                <input
                  id="setup-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="setup-database">Nome do banco</label>
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
            {pending ? "Conectando e preparando as tabelas…" : "Testar e conectar"}
          </button>
          <p className="note">
            Se o banco ainda não existir, o Deixa cria. O endereço fica guardado só neste computador, num
            arquivo que apenas o seu usuário lê.
          </p>
        </form>
      )}
    </div>
  );
}
