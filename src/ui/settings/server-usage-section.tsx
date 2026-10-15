"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  saveModelPriceAction,
  setAiUsageLimitAction,
  updateSharedAiLimitAction,
} from "@/app/actions/ai-usage";
import { hasAnyLimit, type UsageLimit, type UsageOverview } from "@/modules/ai-usage";
import { useToast } from "../shell/toast";
import { useUsageFormat, type UsageFormat } from "./format";
import { LimitForm } from "./limit-form";

type Translate = ReturnType<typeof useTranslations<"serverUsage">>;

function describeLimit(limit: UsageLimit, t: Translate, fmt: UsageFormat): string {
  if (!hasAnyLimit(limit)) return t("limitFree");
  if (limit.usdPerMonth) return t("perMonthValue", { value: fmt.usd(limit.usdPerMonth) });
  if (limit.usdPerDay) return t("perDayValue", { value: fmt.usd(limit.usdPerDay) });
  if (limit.tokensPerMonth)
    return t("perMonthValue", { value: t("tokens", { count: limit.tokensPerMonth }) });
  return t("perDayValue", { value: t("tokens", { count: limit.tokensPerDay ?? 0 }) });
}

const asResult = (result: { ok: true } | { ok: false; message: string }) =>
  result.ok ? { ok: true as const } : { ok: false as const, message: result.message };

function PriceRow({ price }: { price: UsageOverview["prices"][number] }) {
  const t = useTranslations("serverUsage");
  const fmt = useUsageFormat();
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(fmt.decimal(price.inputUsdPerMillion));
  const [output, setOutput] = useState(fmt.decimal(price.outputUsdPerMillion));
  const save = () => {
    const inputValue = fmt.parseDecimal(input);
    const outputValue = fmt.parseDecimal(output);
    if (
      inputValue === null ||
      outputValue === null ||
      Number.isNaN(inputValue) ||
      Number.isNaN(outputValue)
    ) {
      toast(t("bothPrices", { separator: fmt.decimalSeparator }));
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
      toast(t("priceSaved"));
      router.refresh();
    });
  };
  if (!editing) {
    return (
      <button
        className="dueitem"
        style={{ gridTemplateColumns: "1fr 64px 64px", width: "100%", textAlign: "left" }}
        onClick={() => setEditing(true)}
        aria-label={t("editPrice", { model: price.model })}
      >
        <span className="col" style={{ gap: 2, minWidth: 0 }}>
          <span className="mono" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>
            {price.model}
          </span>
          <span className="small muted">
            {price.source === "stored" ? t("editedOn", { date: fmt.date(price.updatedAt) }) : t("default")}
          </span>
        </span>
        <span className="mono" style={{ textAlign: "right", fontSize: 13 }}>
          {fmt.decimal(price.inputUsdPerMillion)}
        </span>
        <span className="mono" style={{ textAlign: "right", fontSize: 13 }}>
          {fmt.decimal(price.outputUsdPerMillion)}
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
          <label htmlFor={`price-in-${price.model}`}>{t("input")}</label>
          <input
            id={`price-in-${price.model}`}
            className="mono"
            inputMode="decimal"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor={`price-out-${price.model}`}>{t("output")}</label>
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
          {t("save")}
        </button>
      </div>
    </div>
  );
}

export function ServerUsageSection({ overview }: { overview: UsageOverview }) {
  const t = useTranslations("serverUsage");
  const fmt = useUsageFormat();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <section className="card col" style={{ gap: 4 }}>
        <div className="col" style={{ gap: 2 }}>
          <span className="eyebrow">{t("allAccounts")}</span>
          <h2 style={{ fontSize: 22 }}>{fmt.usd(overview.totalMonthUsd)}</h2>
        </div>
        {overview.people.map((entry) => {
          const isOpen = open === entry.person.id;
          const status =
            entry.keySource === null
              ? t("noKey")
              : entry.keySource === "user"
                ? t("ownKey")
                : t("globalKeyLimit", { limit: describeLimit(entry.limit, t, fmt) });
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
                {entry.blocked ? <span className="chip bad">{t("paused")}</span> : null}
                <b style={{ fontVariantNumeric: "tabular-nums" }}>{fmt.usd(entry.monthUsd)}</b>
              </button>
              {isOpen && entry.keySource === "global" ? (
                <div className="col" style={{ gap: 12, padding: "8px 0 4px" }}>
                  <LimitForm
                    initial={entry.limit}
                    idPrefix={`shared-${entry.person.id}`}
                    note={t("personNote", { name: entry.person.name })}
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
                    ? t("personOwnKey", { name: entry.person.name })
                    : t("personNoAi", { name: entry.person.name })}
                </p>
              ) : null}
            </div>
          );
        })}
        <p className="small muted" style={{ paddingTop: 8 }}>
          {t("totalsOnly")}
        </p>
      </section>
      <section className="card col" style={{ gap: 12 }}>
        <h2 style={{ fontSize: 17 }}>{t("sharedDefault")}</h2>
        <LimitForm
          initial={overview.sharedDefault}
          idPrefix="shared-default"
          note={t("sharedDefaultNote")}
          save={async (limit) => asResult(await updateSharedAiLimitAction(limit))}
        />
      </section>
      <section className="card col" style={{ gap: 4 }}>
        <div className="col" style={{ gap: 2 }}>
          <h2 style={{ fontSize: 17 }}>{t("prices")}</h2>
          <span className="small muted">{t("pricesNote")}</span>
        </div>
        <div className="dueitem" style={{ gridTemplateColumns: "1fr 64px 64px" }}>
          <span className="eyebrow">{t("model")}</span>
          <span className="eyebrow" style={{ textAlign: "right" }}>
            {t("input")}
          </span>
          <span className="eyebrow" style={{ textAlign: "right" }}>
            {t("output")}
          </span>
        </div>
        {overview.prices.map((price) => (
          <PriceRow key={`${price.provider}/${price.model}`} price={price} />
        ))}
        <p className="small muted" style={{ paddingTop: 8 }}>
          {t("unknownPriceNote")}
        </p>
      </section>
    </>
  );
}
