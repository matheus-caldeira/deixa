"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { removeCredentialAction, saveCredentialAction } from "@/app/actions/profile";
import type { CredentialService, ServiceOverview, StoredState } from "@/modules/ai-credentials";
import { KeyIcon } from "../icons";
import { useToast } from "./toast";

const GUIDE: Record<CredentialService, { use: string; where: string; placeholder: string; without: string }> =
  {
    gemini: {
      use: "Explica o que você marca, monta trilhas, sugere obras e conversa com você. O uso pode gerar cobrança na sua conta Google.",
      where: "aistudio.google.com/apikey",
      placeholder: "AIza…",
      without: "as explicações são simuladas; as revisões continuam funcionando",
    },
    tmdb: {
      use: "Busca séries, filmes, temporadas e imagens.",
      where: "themoviedb.org/settings/api",
      placeholder: "Token de leitura ou chave de API",
      without: "a busca usa só as obras de demonstração",
    },
    opensubtitles: {
      use: "Busca e baixa legendas quando você pede. A cota diária de downloads é a da chave em uso.",
      where: "opensubtitles.com/consumers",
      placeholder: "Chave de API",
      without: "a busca de legendas fica em modo de demonstração; o envio manual continua funcionando",
    },
  };

function fallbackNote(entry: ServiceOverview, scope: "user" | "global"): string {
  const guide = GUIDE[entry.service];
  if (scope === "global") {
    return entry.global.source === "environment"
      ? "Hoje a chave global vem do arquivo .env do servidor. Salvar aqui passa a valer no lugar dela."
      : `Sem chave global: quem não tiver a própria fica sem o serviço (${guide.without}).`;
  }
  return entry.global.source
    ? "Você está usando a chave global deste servidor. Cadastre a sua para usar a própria cota."
    : `Sem chave: ${guide.without}.`;
}

export function CredentialCard({ entry, scope }: { entry: ServiceOverview; scope: "user" | "global" }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const initial: StoredState = scope === "user" ? entry.own : (entry.global.stored ?? { state: "absent" });
  const [stored, setStored] = useState<StoredState>(initial);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const guide = GUIDE[entry.service];
  const name = scope === "global" ? `${entry.label} global` : entry.label;

  const save = () => {
    setMessage({ text: "Testando com uma requisição curta…", error: false });
    startTransition(async () => {
      const result = await saveCredentialAction({ service: entry.service, scope, secret: input });
      if (!result.ok) {
        setMessage({ text: result.message, error: true });
        return;
      }
      setStored(result.data);
      setInput("");
      setMessage(null);
      toast("Chave válida e salva com criptografia.");
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
      toast("Chave removida.");
      router.refresh();
    });

  return (
    <div className="card col" style={{ gap: 10 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="row">
          <KeyIcon width={22} height={22} />
          <b>{entry.label}</b>
        </span>
        {stored.state === "ready" ? <span className="chip good">Conectada</span> : null}
        {stored.state === "unreadable" ? <span className="chip bad">Ilegível</span> : null}
      </div>
      {stored.state === "ready" ? (
        <>
          <span className="mono small">{stored.masked}</span>
          <button
            className="btn ghost"
            style={{ padding: 10, fontSize: 13 }}
            onClick={remove}
            disabled={pending}
            aria-label={`Remover chave: ${name}`}
          >
            Remover chave
          </button>
        </>
      ) : (
        <>
          <p className="small muted">
            {stored.state === "unreadable"
              ? "Não foi possível ler a chave guardada: a chave mestra do servidor mudou ou o dado foi corrompido. Cadastre de novo."
              : `${guide.use} ${fallbackNote(entry, scope)}`}
          </p>
          <div className="field">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={guide.placeholder}
              autoComplete="off"
              spellCheck={false}
              aria-label={`Chave: ${name}`}
            />
          </div>
          <span className="small muted">Onde obter: {guide.where}</span>
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
            aria-label={`Testar e salvar: ${name}`}
          >
            Testar e salvar
          </button>
        </>
      )}
    </div>
  );
}
