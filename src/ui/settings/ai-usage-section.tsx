"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { UsageSummary } from "@/modules/ai-usage";
import { LimitLines } from "./budget-card";
import { useUsageFormat } from "./format";

const TODAY = 6;
const BAR_SCALE = 0.82;
const MIN_BAR = 3;

function Meter({
  label,
  spent,
  tokens,
  limitUsd,
  limitTokens,
}: {
  label: string;
  spent: number;
  tokens: number;
  limitUsd: number | null;
  limitTokens: number | null;
}) {
  const t = useTranslations("usage");
  const fmt = useUsageFormat();
  const ratio = limitUsd ? spent / limitUsd : limitTokens ? tokens / limitTokens : null;
  const tone =
    ratio === null ? undefined : ratio >= 1 ? "var(--bad)" : ratio >= 0.8 ? "var(--cue)" : "var(--good)";
  const limitText = limitUsd
    ? t("ofLimit", { limit: fmt.usd(limitUsd) })
    : limitTokens
      ? t("ofLimit", { limit: t("tokens", { count: fmt.tokens(limitTokens) }) })
      : t("noLimitShort");
  return (
    <div className="col" style={{ gap: 2 }}>
      <span className="eyebrow">{label}</span>
      <div className="sec-h">
        <h2 style={{ fontSize: 22, whiteSpace: "nowrap" }}>{fmt.usd(spent)}</h2>
        <span className="small muted" style={{ textAlign: "right" }}>
          {limitText}
        </span>
      </div>
      <span className="small muted">{t("tokens", { count: fmt.tokens(tokens) })}</span>
      {ratio !== null ? (
        <div className="bar" style={{ marginTop: 6 }}>
          <i style={{ width: `${Math.max(2, Math.min(100, ratio * 100))}%`, background: tone }} />
        </div>
      ) : null}
    </div>
  );
}

export function AiUsageSection({ summary }: { summary: UsageSummary }) {
  const t = useTranslations("usage");
  const fmt = useUsageFormat();
  const format = useFormatter();
  const weekDays = t("weekDays").split(" ");
  const highest = Math.max(...summary.week, 0.01);
  const highestOperation = Math.max(...summary.byOperation.map((entry) => entry.usd), 0.000001);
  const blocked = summary.state.blocked
    ? t(summary.state.blocked === "month" ? "blockedMonth" : "blockedDay", {
        raise: t("blockedRaise"),
      })
    : null;
  const limit = summary.limit;
  return (
    <>
      {blocked ? (
        <div className="hint" style={{ background: "var(--bad-soft)" }} role="alert">
          <span>
            <b style={{ color: "var(--bad)" }}>{t("paused")}</b> {blocked}
          </span>
        </div>
      ) : summary.state.warning ? (
        <div className="hint">
          <span>
            <b>{t("nearLimit")}</b> {t(summary.state.warning === "month" ? "warningMonth" : "warningDay")}
          </span>
        </div>
      ) : null}
      <section className="card col" style={{ gap: 16 }}>
        <Meter
          label={t("today")}
          spent={summary.today.usd}
          tokens={summary.today.tokens}
          limitUsd={limit.usdPerDay}
          limitTokens={limit.tokensPerDay}
        />
        <Meter
          label={t("thisMonth")}
          spent={summary.month.usd}
          tokens={summary.month.tokens}
          limitUsd={limit.usdPerMonth}
          limitTokens={limit.tokensPerMonth}
        />
        <p className="note">
          {t("estimated", { date: fmt.date(summary.pricesUpdatedAt) })}
          {summary.month.unknownCostCalls > 0
            ? ` ${t("unknownCost", { count: summary.month.unknownCostCalls })}`
            : ""}
        </p>
      </section>
      <section className="card col" style={{ gap: 10 }}>
        <div className="sec-h">
          <h2 style={{ fontSize: 17 }}>{t("lastDays", { days: 7 })}</h2>
          <span className="small muted">{t("inUsd")}</span>
        </div>
        <div className="bars">
          {summary.week.map((value, index) => (
            <div key={index} className={index === TODAY ? "today" : ""}>
              <em>{format.number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</em>
              <i style={{ height: `${Math.max(MIN_BAR, (value / highest) * 100 * BAR_SCALE)}%` }} />
            </div>
          ))}
        </div>
        <div className="barlbl">
          {weekDays.map((day, index) => (
            <span key={index} style={index === TODAY ? { color: "var(--brand)" } : undefined}>
              {index === TODAY ? t("today") : day}
            </span>
          ))}
        </div>
      </section>
      {summary.byOperation.length > 0 ? (
        <section className="card col" style={{ gap: 12 }}>
          <div className="sec-h">
            <h2 style={{ fontSize: 17 }}>{t("byOperation")}</h2>
            <span className="small muted">{t("thisMonthLower")}</span>
          </div>
          {summary.byOperation.map((entry) => (
            <div key={entry.operation} className="skill" style={{ gridTemplateColumns: "104px 1fr 72px" }}>
              <span>{t(`operations.${entry.operation}`)}</span>
              <div className="bar">
                <i style={{ width: `${(entry.usd / highestOperation) * 100}%` }} />
              </div>
              <b>{fmt.usd(entry.usd)}</b>
            </div>
          ))}
        </section>
      ) : null}
      {summary.byModel.length > 0 ? (
        <section className="card col" style={{ gap: 4 }}>
          <div className="sec-h">
            <h2 style={{ fontSize: 17 }}>{t("byModel")}</h2>
            <span className="small muted">{t("thisMonthLower")}</span>
          </div>
          {summary.byModel.map((entry) => (
            <div key={`${entry.provider}/${entry.model}/${entry.keySource}`} className="dueitem">
              <span className="col" style={{ gap: 2, minWidth: 0 }}>
                <b className="mono" style={{ fontSize: 13 }}>
                  {entry.model}
                </b>
                <span className="small muted">
                  {entry.provider} · {entry.keySource === "user" ? t("yourKey") : t("globalKey")} ·{" "}
                  {t("tokens", { count: fmt.tokens(entry.tokens) })}
                </span>
              </span>
              <b style={{ fontVariantNumeric: "tabular-nums" }}>{fmt.usd(entry.usd)}</b>
            </div>
          ))}
        </section>
      ) : null}
      <section className="card col" style={{ gap: 12 }}>
        <h2 style={{ fontSize: 17 }}>{t("yourLimit")}</h2>
        <LimitLines limit={limit} />
        <Link
          className="small"
          style={{ color: "var(--brand-deep)", fontWeight: 600 }}
          href="/settings?tab=ai"
        >
          {t("editBudget")}
        </Link>
      </section>
    </>
  );
}
