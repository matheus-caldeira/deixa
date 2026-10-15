"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type { UsageLimit } from "@/modules/ai-usage";
import { useToast } from "../shell/toast";
import { useUsageFormat } from "./format";

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
  const t = useTranslations("limitForm");
  const fmt = useUsageFormat();
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [unit, setUnit] = useState<Unit>(initial.tokensPerDay || initial.tokensPerMonth ? "tokens" : "usd");
  const [day, setDay] = useState(fmt.decimal(unit === "usd" ? initial.usdPerDay : initial.tokensPerDay));
  const [month, setMonth] = useState(
    fmt.decimal(unit === "usd" ? initial.usdPerMonth : initial.tokensPerMonth),
  );
  const [error, setError] = useState("");

  const switchUnit = (next: Unit) => {
    setUnit(next);
    setDay(fmt.decimal(next === "usd" ? initial.usdPerDay : initial.tokensPerDay));
    setMonth(fmt.decimal(next === "usd" ? initial.usdPerMonth : initial.tokensPerMonth));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const dayValue = fmt.parseDecimal(day);
    const monthValue = fmt.parseDecimal(month);
    if (Number.isNaN(dayValue) || Number.isNaN(monthValue)) {
      setError(t("invalidNumber", { separator: fmt.decimalSeparator }));
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
      toast(t("saved"));
      router.refresh();
    });
  };

  return (
    <form className="col" style={{ gap: 12 }} onSubmit={submit}>
      <div className="seg" role="radiogroup" aria-label={t("unit")}>
        <button type="button" className={unit === "usd" ? "on" : ""} onClick={() => switchUnit("usd")}>
          {t("inUsd")}
        </button>
        <button type="button" className={unit === "tokens" ? "on" : ""} onClick={() => switchUnit("tokens")}>
          {t("inTokens")}
        </button>
      </div>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor={`${idPrefix}-day`}>{t("perDay")}</label>
          <input
            id={`${idPrefix}-day`}
            className="mono"
            inputMode="decimal"
            value={day}
            onChange={(event) => setDay(event.target.value)}
            placeholder={t("noLimit")}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor={`${idPrefix}-month`}>{t("perMonth")}</label>
          <input
            id={`${idPrefix}-month`}
            className="mono"
            inputMode="decimal"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            placeholder={t("noLimit")}
          />
        </div>
      </div>
      <p className="small muted">
        {note} {t("pauseNote")}
      </p>
      {error ? <p className="formerr">{error}</p> : null}
      <button className="btn" style={{ padding: 12, fontSize: 13 }} type="submit" disabled={pending}>
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
