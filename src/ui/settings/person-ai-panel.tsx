"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { assignAiModelAction } from "@/app/actions/ai-models";
import { setAiUsageLimitAction } from "@/app/actions/ai-usage";
import {
  AI_SERVICES,
  SERVICE_LABELS,
  SUGGESTED_MODELS,
  type AiService,
  type ModelChoice,
} from "@/modules/ai-credentials";
import type { LimitKey, PersonUsage, UsageLimit } from "@/modules/ai-usage";
import { useToast } from "../shell/toast";
import { LimitForm } from "./limit-form";

export type PersonAiPanelView = {
  entry: PersonUsage;
  assigned: ModelChoice | null;
  serverDefault: ModelChoice;
  sharedServices: AiService[];
};

function AssignedModelForm({ view }: { view: PersonAiPanelView }) {
  const t = useTranslations("personAi");
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<ModelChoice | null>(view.assigned);
  const [error, setError] = useState("");
  const id = `assigned-${view.entry.person.id}`;

  const pick = (key: string) => {
    const service = AI_SERVICES.find((candidate) => candidate === key);
    setChoice(service ? { provider: service, model: SUGGESTED_MODELS[service].generation } : null);
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await assignAiModelAction({ userId: view.entry.person.id, generation: choice });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast(t("modelSaved"));
      router.refresh();
    });
  };

  return (
    <form className="col" style={{ gap: 10 }} onSubmit={save}>
      <div className="field">
        <label htmlFor={id}>{t("model")}</label>
        <select id={id} value={choice?.provider ?? ""} onChange={(event) => pick(event.target.value)}>
          <option value="">
            {t("serverDefault", {
              value: `${SERVICE_LABELS[view.serverDefault.provider]} · ${view.serverDefault.model}`,
            })}
          </option>
          {view.sharedServices.map((service) => (
            <option key={service} value={service}>
              {SERVICE_LABELS[service]}
            </option>
          ))}
        </select>
        {choice ? (
          <input
            className="mono"
            value={choice.model}
            onChange={(event) => setChoice({ ...choice, model: event.target.value })}
            placeholder={t("modelName")}
            aria-label={t("modelName")}
            autoComplete="off"
            spellCheck={false}
          />
        ) : null}
        <span className="small muted">{t("modelNote", { name: view.entry.person.name })}</span>
      </div>
      {error ? <p className="formerr">{error}</p> : null}
      <button className="btn ghost" style={{ padding: 12, fontSize: 13 }} type="submit" disabled={pending}>
        {pending ? t("saving") : t("saveModel")}
      </button>
    </form>
  );
}

export function PersonAiPanel({ view }: { view: PersonAiPanelView }) {
  const t = useTranslations("personAi");
  const { person, limits } = view.entry;
  const save = (key: LimitKey) => async (limit: UsageLimit) => {
    const result = await setAiUsageLimitAction({
      target: { scope: "person", userId: person.id, key },
      limit,
    });
    return result.ok ? { ok: true as const } : { ok: false as const, message: result.message };
  };
  return (
    <div className="col" style={{ gap: 16, padding: "8px 0 4px" }}>
      <AssignedModelForm view={view} />
      <span className="eyebrow">{t("sharedLimit")}</span>
      <LimitForm
        initial={limits.shared}
        idPrefix={`shared-${person.id}`}
        note={t("sharedLimitNote", { name: person.name })}
        save={save("shared")}
      />
      <span className="eyebrow">{t("ownLimit")}</span>
      <LimitForm
        initial={limits.own}
        idPrefix={`own-${person.id}`}
        note={t("ownLimitNote", { name: person.name })}
        save={save("own")}
      />
    </div>
  );
}
