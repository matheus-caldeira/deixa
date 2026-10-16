"use client";

import { useTranslations } from "next-intl";
import { setAiUsageLimitAction } from "@/app/actions/ai-usage";
import { hasAnyLimit, type LimitKey, type UsageLimit, type UsageSummary } from "@/modules/ai-usage";
import { useUsageFormat } from "./format";
import { LimitForm } from "./limit-form";

export function LimitLines({ limit }: { limit: UsageLimit }) {
  const t = useTranslations("budget");
  const fmt = useUsageFormat();
  const line = (label: string, usd: number | null, tokens: number | null) => (
    <>
      <dt>{label}</dt>
      <dd>{usd ? fmt.usd(usd) : tokens ? t("tokens", { count: fmt.tokens(tokens) }) : t("noLimit")}</dd>
    </>
  );
  return (
    <dl className="kv">
      {line(t("perDay"), limit.usdPerDay, limit.tokensPerDay)}
      {line(t("perMonth"), limit.usdPerMonth, limit.tokensPerMonth)}
    </dl>
  );
}

const saveOwn = (key: LimitKey) => async (limit: UsageLimit) => {
  const result = await setAiUsageLimitAction({ target: { scope: "own", key }, limit });
  return result.ok ? { ok: true as const } : { ok: false as const, message: result.message };
};

export function BudgetCard({ summary }: { summary: UsageSummary }) {
  const t = useTranslations("budget");
  const fmt = useUsageFormat();
  const shared = summary.keySource === "global";
  return (
    <section className="card col" style={{ gap: 12 }} aria-labelledby="budget-title">
      <div className="col" style={{ gap: 2 }}>
        <h2 id="budget-title" style={{ fontSize: 17 }}>
          {t("title")}
        </h2>
        <span className="small muted">
          {t("spent", { today: fmt.usd(summary.today.usd), month: fmt.usd(summary.month.usd) })}
        </span>
      </div>
      {shared ? (
        <>
          <span className="eyebrow">{t("adminLimit")}</span>
          <LimitLines limit={summary.limits.shared} />
          <p className="small muted">
            {hasAnyLimit(summary.limits.shared) ? t("adminLimitNote") : t("adminNoLimitNote")}
          </p>
          <span className="eyebrow">{t("yourCap")}</span>
          <LimitForm
            initial={summary.limits.sharedCap}
            idPrefix="shared-cap"
            note={t("capNote")}
            save={saveOwn("shared")}
          />
        </>
      ) : (
        <LimitForm
          initial={summary.limits.own}
          idPrefix="own-limit"
          note={summary.keySource === null ? t("ownNoKeyNote") : t("ownNote")}
          save={saveOwn("own")}
        />
      )}
    </section>
  );
}
