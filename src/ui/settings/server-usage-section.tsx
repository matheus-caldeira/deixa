"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  saveModelPriceAction,
  setAiUsageLimitAction,
  updateSharedAiLimitAction,
} from "@/app/actions/ai-usage";
import { hasAnyLimit, type UsageLimit, type UsageOverview } from "@/modules/ai-usage";
import { useToast } from "../shell/toast";
import { decimalText, formatDate, formatUsd, parseDecimal } from "./format";
import { LimitForm } from "./limit-form";

function describeLimit(limit: UsageLimit): string {
  if (!hasAnyLimit(limit)) return "livre";
  if (limit.usdPerMonth) return `${formatUsd(limit.usdPerMonth)} por mês`;
  if (limit.usdPerDay) return `${formatUsd(limit.usdPerDay)} por dia`;
  if (limit.tokensPerMonth) return `${limit.tokensPerMonth.toLocaleString("pt-BR")} tokens por mês`;
  return `${(limit.tokensPerDay ?? 0).toLocaleString("pt-BR")} tokens por dia`;
}

const asResult = (result: { ok: true } | { ok: false; message: string }) =>
  result.ok ? { ok: true as const } : { ok: false as const, message: result.message };

function PriceRow({ price }: { price: UsageOverview["prices"][number] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(decimalText(price.inputUsdPerMillion));
  const [output, setOutput] = useState(decimalText(price.outputUsdPerMillion));
  const save = () => {
    const inputValue = parseDecimal(input);
    const outputValue = parseDecimal(output);
    if (
      inputValue === null ||
      outputValue === null ||
      Number.isNaN(inputValue) ||
      Number.isNaN(outputValue)
    ) {
      toast("Informe os dois preços, com vírgula para os centavos.");
      return;
    }
    startTransition(async () => {
      const result = await saveModelPriceAction({
        provider: price.provider,
        model: price.model,
        inputUsdPerMillion: inputValue,
        outputUsdPerMillion: outputValue,
      });
      if (!result.ok) {
        toast(result.message);
        return;
      }
      setEditing(false);
      toast("Preço salvo.");
      router.refresh();
    });
  };
  if (!editing) {
    return (
      <button
        className="dueitem"
        style={{ gridTemplateColumns: "1fr 64px 64px", width: "100%", textAlign: "left" }}
        onClick={() => setEditing(true)}
        aria-label={`Editar preço de ${price.model}`}
      >
        <span className="col" style={{ gap: 2, minWidth: 0 }}>
          <span className="mono" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>
            {price.model}
          </span>
          <span className="small muted">
            {price.source === "stored" ? `editado em ${formatDate(price.updatedAt)}` : "padrão"}
          </span>
        </span>
        <span className="mono" style={{ textAlign: "right", fontSize: 13 }}>
          {decimalText(price.inputUsdPerMillion)}
        </span>
        <span className="mono" style={{ textAlign: "right", fontSize: 13 }}>
          {decimalText(price.outputUsdPerMillion)}
        </span>
      </button>
    );
  }
  return (
    <div className="dueitem" style={{ gridTemplateColumns: "1fr" }}>
      <span className="mono" style={{ fontSize: 13 }}>
        {price.model}
      </span>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor={`price-in-${price.model}`}>Entrada</label>
          <input
            id={`price-in-${price.model}`}
            className="mono"
            inputMode="decimal"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor={`price-out-${price.model}`}>Saída</label>
          <input
            id={`price-out-${price.model}`}
            className="mono"
            inputMode="decimal"
            value={output}
            onChange={(event) => setOutput(event.target.value)}
          />
        </div>
        <button
          className="btn"
          style={{ padding: "12px 14px", fontSize: 13 }}
          onClick={save}
          disabled={pending}
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

export function ServerUsageSection({ overview }: { overview: UsageOverview }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <section className="card col" style={{ gap: 4 }}>
        <div className="col" style={{ gap: 2 }}>
          <span className="eyebrow">Todas as contas · este mês</span>
          <h2 style={{ fontSize: 22 }}>{formatUsd(overview.totalMonthUsd)}</h2>
        </div>
        {overview.people.map((entry) => {
          const isOpen = open === entry.person.id;
          const status =
            entry.keySource === null
              ? "sem chave"
              : entry.keySource === "user"
                ? "chave própria"
                : `chave global · limite ${describeLimit(entry.limit)}`;
          return (
            <div key={entry.person.id} className="dueitem" style={{ gridTemplateColumns: "1fr" }}>
              <button
                className="row"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => setOpen(isOpen ? null : entry.person.id)}
                aria-expanded={isOpen}
              >
                <span
                  className="avatar"
                  style={{
                    background: entry.person.avatarColor,
                    width: 32,
                    height: 32,
                    fontSize: 14,
                    borderRadius: 10,
                  }}
                >
                  {entry.person.name.slice(0, 1)}
                </span>
                <span className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
                  <b>{entry.person.name}</b>
                  <span className="small muted">{status}</span>
                </span>
                {entry.blocked ? <span className="chip bad">Pausada</span> : null}
                <b style={{ fontVariantNumeric: "tabular-nums" }}>{formatUsd(entry.monthUsd)}</b>
              </button>
              {isOpen && entry.keySource === "global" ? (
                <div className="col" style={{ gap: 12, padding: "8px 0 4px" }}>
                  <LimitForm
                    initial={entry.limit}
                    idPrefix={`shared-${entry.person.id}`}
                    note={`Vale só para ${entry.person.name}, enquanto usar a chave global.`}
                    save={async (limit) =>
                      asResult(
                        await setAiUsageLimitAction({
                          target: { scope: "shared", userId: entry.person.id },
                          limit,
                        }),
                      )
                    }
                  />
                </div>
              ) : isOpen ? (
                <p className="small muted" style={{ padding: "4px 0" }}>
                  {entry.keySource === "user"
                    ? `${entry.person.name} usa a própria chave e define o próprio limite.`
                    : `${entry.person.name} ainda não usa IA.`}
                </p>
              ) : null}
            </div>
          );
        })}
        <p className="small muted" style={{ paddingTop: 8 }}>
          Você vê só os totais. O que cada pessoa fez com a IA não aparece aqui.
        </p>
      </section>
      <section className="card col" style={{ gap: 12 }}>
        <h2 style={{ fontSize: 17 }}>Limite padrão da chave global</h2>
        <LimitForm
          initial={overview.sharedDefault}
          idPrefix="shared-default"
          note="Vale para cada conta que usa a chave global e não tem limite próprio."
          save={async (limit) => asResult(await updateSharedAiLimitAction(limit))}
        />
      </section>
      <section className="card col" style={{ gap: 4 }}>
        <div className="col" style={{ gap: 2 }}>
          <h2 style={{ fontSize: 17 }}>Preços por modelo</h2>
          <span className="small muted">Em dólar, por 1 milhão de tokens. Toque numa linha para editar.</span>
        </div>
        <div className="dueitem" style={{ gridTemplateColumns: "1fr 64px 64px" }}>
          <span className="eyebrow">Modelo</span>
          <span className="eyebrow" style={{ textAlign: "right" }}>
            Entrada
          </span>
          <span className="eyebrow" style={{ textAlign: "right" }}>
            Saída
          </span>
        </div>
        {overview.prices.map((price) => (
          <PriceRow key={`${price.provider}/${price.model}`} price={price} />
        ))}
        <p className="small muted" style={{ paddingTop: 8 }}>
          Modelo sem preço cadastrado tem os tokens contados e o valor aparece como desconhecido.
        </p>
      </section>
    </>
  );
}
