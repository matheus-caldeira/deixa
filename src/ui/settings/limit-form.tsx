"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { UsageLimit } from "@/modules/ai-usage";
import { useToast } from "../shell/toast";
import { decimalText, parseDecimal } from "./format";

type Unit = "usd" | "tokens";

export function LimitForm({
  initial,
  note,
  idPrefix,
  save,
}: {
  initial: UsageLimit;
  note: string;
  idPrefix: string;
  save: (limit: UsageLimit) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [unit, setUnit] = useState<Unit>(initial.tokensPerDay || initial.tokensPerMonth ? "tokens" : "usd");
  const [day, setDay] = useState(decimalText(unit === "usd" ? initial.usdPerDay : initial.tokensPerDay));
  const [month, setMonth] = useState(
    decimalText(unit === "usd" ? initial.usdPerMonth : initial.tokensPerMonth),
  );
  const [error, setError] = useState("");

  const switchUnit = (next: Unit) => {
    setUnit(next);
    setDay(decimalText(next === "usd" ? initial.usdPerDay : initial.tokensPerDay));
    setMonth(decimalText(next === "usd" ? initial.usdPerMonth : initial.tokensPerMonth));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const dayValue = parseDecimal(day);
    const monthValue = parseDecimal(month);
    if (Number.isNaN(dayValue) || Number.isNaN(monthValue)) {
      setError("Use números, com vírgula para os centavos. Em branco, sem limite.");
      return;
    }
    const asTokens = (value: number | null) => (value === null ? null : Math.round(value));
    const limit: UsageLimit =
      unit === "usd"
        ? { usdPerDay: dayValue, usdPerMonth: monthValue, tokensPerDay: null, tokensPerMonth: null }
        : {
            usdPerDay: null,
            usdPerMonth: null,
            tokensPerDay: asTokens(dayValue),
            tokensPerMonth: asTokens(monthValue),
          };
    setError("");
    startTransition(async () => {
      const result = await save(limit);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast("Limite salvo.");
      router.refresh();
    });
  };

  return (
    <form className="col" style={{ gap: 12 }} onSubmit={submit}>
      <div className="seg" role="radiogroup" aria-label="Unidade do limite">
        <button type="button" className={unit === "usd" ? "on" : ""} onClick={() => switchUnit("usd")}>
          Em dólar
        </button>
        <button type="button" className={unit === "tokens" ? "on" : ""} onClick={() => switchUnit("tokens")}>
          Em tokens
        </button>
      </div>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor={`${idPrefix}-day`}>Por dia</label>
          <input
            id={`${idPrefix}-day`}
            className="mono"
            inputMode="decimal"
            value={day}
            onChange={(event) => setDay(event.target.value)}
            placeholder="Sem limite"
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor={`${idPrefix}-month`}>Por mês</label>
          <input
            id={`${idPrefix}-month`}
            className="mono"
            inputMode="decimal"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            placeholder="Sem limite"
          />
        </div>
      </div>
      <p className="small muted">
        {note} Ao passar do limite, toda a IA pausa até o período virar ou o limite subir. Ler, marcar e
        revisar continuam funcionando.
      </p>
      {error ? <p className="formerr">{error}</p> : null}
      <button className="btn" style={{ padding: 12, fontSize: 13 }} type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar limite"}
      </button>
    </form>
  );
}
