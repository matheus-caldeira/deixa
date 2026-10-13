"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { removeCredentialAction, saveCredentialAction } from "@/app/actions/profile";
import {
  SECRET_KINDS,
  endpointSecret,
  type CredentialService,
  type ServiceOverview,
  type StoredState,
} from "@/modules/ai-credentials";
import { KeyIcon } from "../icons";
import { useToast } from "./toast";

type Guide = { use: string; where: string; placeholder: string; without: string };

const GUIDE: Record<CredentialService, Guide> = {
  gemini: {
    use: "Explica o que você marca, monta trilhas, sugere obras e conversa com você. O uso pode gerar cobrança na sua conta Google.",
    where: "aistudio.google.com/apikey",
    placeholder: "AIza…",
    without: "as explicações são simuladas; as revisões continuam funcionando",
  },
  openai: {
    use: "Modelos GPT para cards, trilhas, sugestões e tutor. O uso é cobrado na sua conta OpenAI.",
    where: "platform.openai.com/api-keys",
    placeholder: "sk-…",
    without: "a IA usa outro provedor ou fica em modo de demonstração",
  },
  anthropic: {
    use: "Modelos Claude para cards, trilhas, sugestões e tutor. Sem embeddings. O uso é cobrado na sua conta Anthropic.",
    where: "console.anthropic.com/settings/keys",
    placeholder: "sk-ant-…",
    without: "a IA usa outro provedor ou fica em modo de demonstração",
  },
  openrouter: {
    use: "Vários modelos com uma chave só. O uso é cobrado na sua conta OpenRouter.",
    where: "openrouter.ai/keys",
    placeholder: "sk-or-…",
    without: "a IA usa outro provedor ou fica em modo de demonstração",
  },
  ollama: {
    use: "Modelos rodando na sua máquina, sem custo por uso. Quem chama o endereço é o servidor do Deixa.",
    where: "ollama.com",
    placeholder: "http://localhost:11434",
    without: "a IA usa outro provedor ou fica em modo de demonstração",
  },
  openai_compatible: {
    use: "Qualquer servidor que fale o formato da OpenAI. Quem chama o endereço é o servidor do Deixa.",
    where: "a documentação do seu servidor",
    placeholder: "https://seu-servidor/v1",
    without: "a IA usa outro provedor ou fica em modo de demonstração",
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
  const [endpointKey, setEndpointKey] = useState("");
  const isEndpoint = SECRET_KINDS[entry.service] === "endpoint";
  const secret = isEndpoint
    ? endpointSecret({ baseUrl: input.trim(), apiKey: endpointKey.trim() === "" ? null : endpointKey.trim() })
    : input;
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const guide = GUIDE[entry.service];
  const name = scope === "global" ? `${entry.label} global` : entry.label;

  const save = () => {
    setMessage({ text: "Testando com uma requisição curta…", error: false });
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
      toast(isEndpoint ? "Endereço respondeu e foi salvo." : "Chave válida e salva com criptografia.");
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
        {stored.state === "ready" ? (
          <span className="chip good">{isEndpoint ? "Configurado" : "Conectada"}</span>
        ) : null}
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
            {isEndpoint ? "Remover endereço" : "Remover chave"}
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
              aria-label={isEndpoint ? `Endereço: ${name}` : `Chave: ${name}`}
            />
          </div>
          {entry.service === "openai_compatible" ? (
            <div className="field">
              <input
                value={endpointKey}
                onChange={(event) => setEndpointKey(event.target.value)}
                placeholder="Chave, se o servidor pedir"
                autoComplete="off"
                spellCheck={false}
                aria-label={`Chave: ${name}`}
              />
            </div>
          ) : null}
          <span className="small muted">
            {isEndpoint ? "Saiba mais em" : "Onde obter"}: {guide.where}
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
            aria-label={`Testar e salvar: ${name}`}
          >
            Testar e salvar
          </button>
        </>
      )}
    </div>
  );
}
