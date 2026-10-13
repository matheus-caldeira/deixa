"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setAiModelsAction, updateAiDefaultsAction } from "@/app/actions/ai-models";
import {
  AI_SERVICES,
  PROVIDERS_WITH_EMBEDDINGS,
  SERVICE_LABELS,
  SUGGESTED_MODELS,
  type AiModels,
  type AiService,
  type ModelChoice,
  type ServiceOverview,
} from "@/modules/ai-credentials";
import { useToast } from "../shell/toast";

type Purpose = "generation" | "embedding";
type Selection = ModelChoice | "local" | null;

export type ModelChoiceView = {
  scope: "user" | "global";
  models: AiModels;
  defaults: { aiGeneration: ModelChoice; aiEmbedding: ModelChoice | null };
  credentials: ServiceOverview[];
  customEndpointsAllowed: boolean;
};

const HELP: Record<Purpose, string> = {
  generation: "Cards, traduções, tutor, plano de aula e motivo das sugestões.",
  embedding:
    "Usados nas sugestões de obras. Trocar de modelo recalcula só os vetores que faltam; os antigos ficam guardados.",
};
const LABELS: Record<Purpose, string> = { generation: "Geração de texto", embedding: "Embeddings" };
const ENDPOINT_SERVICES = new Set<AiService>(["ollama", "openai_compatible"]);

function selectionKey(selection: Selection): string {
  if (selection === null) return "";
  return selection === "local" ? "local" : selection.provider;
}

function describeDefault(choice: ModelChoice | null): string {
  if (!choice) return "Padrão do servidor: cálculo local, sem IA";
  return `Padrão do servidor: ${SERVICE_LABELS[choice.provider]} · ${choice.model}`;
}

export function ModelChoiceCard({ view }: { view: ModelChoiceView }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const global = view.scope === "global";
  const [generation, setGeneration] = useState<Selection>(
    global ? view.defaults.aiGeneration : view.models.generation,
  );
  const [embedding, setEmbedding] = useState<Selection>(
    global ? view.defaults.aiEmbedding : view.models.embedding,
  );
  const [error, setError] = useState("");

  const available = (service: AiService): boolean => {
    if (ENDPOINT_SERVICES.has(service) && !view.customEndpointsAllowed) return false;
    const entry = view.credentials.find((candidate) => candidate.service === service);
    if (!entry) return false;
    return global ? entry.global.source !== null : entry.active !== "none";
  };

  const pick = (purpose: Purpose, key: string) => {
    const set = purpose === "generation" ? setGeneration : setEmbedding;
    if (key === "") return set(null);
    if (key === "local") return set("local");
    const service = AI_SERVICES.find((candidate) => candidate === key);
    if (!service) return;
    const suggested = SUGGESTED_MODELS[service][purpose] ?? "";
    set({ provider: service, model: suggested });
  };

  const rename = (purpose: Purpose, model: string) => {
    const current = purpose === "generation" ? generation : embedding;
    if (!current || current === "local") return;
    (purpose === "generation" ? setGeneration : setEmbedding)({ ...current, model });
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = global
        ? await updateAiDefaultsAction({
            aiGeneration:
              generation === "local" || generation === null ? view.defaults.aiGeneration : generation,
            aiEmbedding: embedding === "local" ? null : embedding,
          })
        : await setAiModelsAction({ generation: generation === "local" ? null : generation, embedding });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast(global ? "Modelos padrão salvos." : "Modelos salvos.");
      router.refresh();
    });
  };

  const field = (purpose: Purpose) => {
    const selection = purpose === "generation" ? generation : embedding;
    const options = AI_SERVICES.filter(
      (service) => purpose === "generation" || PROVIDERS_WITH_EMBEDDINGS.has(service),
    );
    const id = `model-${purpose}`;
    return (
      <div className="field">
        <label htmlFor={id}>{LABELS[purpose]}</label>
        <select
          id={id}
          value={selectionKey(selection)}
          onChange={(event) => pick(purpose, event.target.value)}
        >
          {global ? null : (
            <option value="">
              {describeDefault(
                purpose === "generation" ? view.defaults.aiGeneration : view.defaults.aiEmbedding,
              )}
            </option>
          )}
          {options.map((service) => (
            <option key={service} value={service} disabled={!available(service)}>
              {SERVICE_LABELS[service]}
              {available(service) ? "" : " (sem chave)"}
            </option>
          ))}
          {purpose === "embedding" ? <option value="local">Cálculo local, sem IA</option> : null}
        </select>
        {selection && selection !== "local" ? (
          <input
            className="mono"
            value={selection.model}
            onChange={(event) => rename(purpose, event.target.value)}
            placeholder="Nome do modelo"
            aria-label={`Modelo de ${LABELS[purpose].toLowerCase()}`}
            autoComplete="off"
            spellCheck={false}
          />
        ) : null}
        <span className="small muted">{HELP[purpose]}</span>
      </div>
    );
  };

  return (
    <form className="card col" style={{ gap: 14 }} onSubmit={save}>
      <h2 style={{ fontSize: 17 }}>{global ? "Modelos padrão do servidor" : "Modelos em uso"}</h2>
      {field("generation")}
      {field("embedding")}
      {error ? <p className="formerr">{error}</p> : null}
      <button className="btn" style={{ padding: 12, fontSize: 13 }} type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar modelos"}
      </button>
    </form>
  );
}
