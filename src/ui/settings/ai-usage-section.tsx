"use client";

import { setAiUsageLimitAction } from "@/app/actions/ai-usage";
import { OPERATION_LABELS, hasAnyLimit, type UsageLimit, type UsageSummary } from "@/modules/ai-usage";
import { formatDate, formatTokens, formatUsd } from "./format";
import { LimitForm } from "./limit-form";

const DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const TODAY = 6;
const BAR_SCALE = 0.82;
const MIN_BAR = 3;
const PROVIDER_LABELS: Record<string, string> = { google: "Google" };

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
  const ratio = limitUsd ? spent / limitUsd : limitTokens ? tokens / limitTokens : null;
  const tone =
    ratio === null ? undefined : ratio >= 1 ? "var(--bad)" : ratio >= 0.8 ? "var(--cue)" : "var(--good)";
  const limitText = limitUsd
    ? `de ${formatUsd(limitUsd)}`
    : limitTokens
      ? `de ${formatTokens(limitTokens)} tokens`
      : "sem limite";
  return (
    <div className="col" style={{ gap: 2 }}>
      <span className="eyebrow">{label}</span>
      <div className="sec-h">
        <h2 style={{ fontSize: 22, whiteSpace: "nowrap" }}>{formatUsd(spent)}</h2>
        <span className="small muted" style={{ textAlign: "right" }}>
          {limitText}
        </span>
      </div>
      <span className="small muted">{formatTokens(tokens)} tokens</span>
      {ratio !== null ? (
        <div className="bar" style={{ marginTop: 6 }}>
          <i style={{ width: `${Math.max(2, Math.min(100, ratio * 100))}%`, background: tone }} />
        </div>
      ) : null}
    </div>
  );
}

function blockedNotice(summary: UsageSummary): string | null {
  if (!summary.state.blocked) return null;
  const period = summary.state.blocked === "month" ? "deste mês" : "de hoje";
  const back = summary.state.blocked === "month" ? "no dia 1º" : "amanhã";
  const raise = summary.ownsLimit ? ", ou quando você aumentar o limite" : "";
  return `Você passou do limite ${period}. Ela volta ${back}${raise}. Ler, marcar e revisar continuam funcionando.`;
}

export function AiUsageSection({ summary }: { summary: UsageSummary }) {
  const highest = Math.max(...summary.week, 0.01);
  const highestOperation = Math.max(...summary.byOperation.map((entry) => entry.usd), 0.000001);
  const blocked = blockedNotice(summary);
  const limit = summary.limit;
  const limitLine = (label: string, usd: number | null, tokens: number | null) => (
    <>
      <dt>{label}</dt>
      <dd>{usd ? formatUsd(usd) : tokens ? `${formatTokens(tokens)} tokens` : "Sem limite"}</dd>
    </>
  );
  const saveOwn = async (next: UsageLimit) => {
    const result = await setAiUsageLimitAction({ target: { scope: "own" }, limit: next });
    return result.ok ? { ok: true as const } : { ok: false as const, message: result.message };
  };

  return (
    <>
      {blocked ? (
        <div className="hint" style={{ background: "var(--bad-soft)" }} role="alert">
          <span>
            <b style={{ color: "var(--bad)" }}>IA pausada.</b> {blocked}
          </span>
        </div>
      ) : summary.state.warning ? (
        <div className="hint">
          <span>
            <b>Perto do limite.</b> Você já usou mais de 80% do limite{" "}
            {summary.state.warning === "month" ? "deste mês" : "de hoje"}.
          </span>
        </div>
      ) : null}
      <section className="card col" style={{ gap: 16 }}>
        <Meter
          label="Hoje"
          spent={summary.today.usd}
          tokens={summary.today.tokens}
          limitUsd={limit.usdPerDay}
          limitTokens={limit.tokensPerDay}
        />
        <Meter
          label="Este mês"
          spent={summary.month.usd}
          tokens={summary.month.tokens}
          limitUsd={limit.usdPerMonth}
          limitTokens={limit.tokensPerMonth}
        />
        <p className="note">
          Valores estimados pela tabela de preços de {formatDate(summary.pricesUpdatedAt)}. A cobrança real é
          a do provedor.
          {summary.month.unknownCostCalls > 0
            ? ` ${summary.month.unknownCostCalls} chamada(s) deste mês usaram modelo sem preço cadastrado e não entram no valor.`
            : ""}
        </p>
      </section>
      <section className="card col" style={{ gap: 10 }}>
        <div className="sec-h">
          <h2 style={{ fontSize: 17 }}>Últimos 7 dias</h2>
          <span className="small muted">em dólar</span>
        </div>
        <div className="bars">
          {summary.week.map((value, index) => (
            <div key={index} className={index === TODAY ? "today" : ""}>
              <em>{value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</em>
              <i style={{ height: `${Math.max(MIN_BAR, (value / highest) * 100 * BAR_SCALE)}%` }} />
            </div>
          ))}
        </div>
        <div className="barlbl">
          {DAYS.map((day, index) => (
            <span key={index} style={index === TODAY ? { color: "var(--brand)" } : undefined}>
              {index === TODAY ? "Hoje" : day}
            </span>
          ))}
        </div>
      </section>
      {summary.byOperation.length > 0 ? (
        <section className="card col" style={{ gap: 12 }}>
          <div className="sec-h">
            <h2 style={{ fontSize: 17 }}>Por tipo de uso</h2>
            <span className="small muted">este mês</span>
          </div>
          {summary.byOperation.map((entry) => (
            <div key={entry.operation} className="skill" style={{ gridTemplateColumns: "104px 1fr 72px" }}>
              <span>{OPERATION_LABELS[entry.operation]}</span>
              <div className="bar">
                <i style={{ width: `${(entry.usd / highestOperation) * 100}%` }} />
              </div>
              <b>{formatUsd(entry.usd)}</b>
            </div>
          ))}
        </section>
      ) : null}
      {summary.byModel.length > 0 ? (
        <section className="card col" style={{ gap: 4 }}>
          <div className="sec-h">
            <h2 style={{ fontSize: 17 }}>Por modelo</h2>
            <span className="small muted">este mês</span>
          </div>
          {summary.byModel.map((entry) => (
            <div key={`${entry.provider}/${entry.model}/${entry.keySource}`} className="dueitem">
              <span className="col" style={{ gap: 2, minWidth: 0 }}>
                <b className="mono" style={{ fontSize: 13 }}>
                  {entry.model}
                </b>
                <span className="small muted">
                  {PROVIDER_LABELS[entry.provider] ?? entry.provider} ·{" "}
                  {entry.keySource === "user" ? "sua chave" : "chave global"} · {formatTokens(entry.tokens)}{" "}
                  tokens
                </span>
              </span>
              <b style={{ fontVariantNumeric: "tabular-nums" }}>{formatUsd(entry.usd)}</b>
            </div>
          ))}
        </section>
      ) : null}
      <section className="card col" style={{ gap: 12 }}>
        <h2 style={{ fontSize: 17 }}>Seu limite</h2>
        {summary.keySource === null ? (
          <p className="small muted">Nenhuma chave de IA em uso. O limite aparece aqui quando houver uma.</p>
        ) : summary.ownsLimit ? (
          <LimitForm
            initial={limit}
            idPrefix="own-limit"
            note="Vale para o uso com a sua chave. Em branco, sem limite."
            save={saveOwn}
          />
        ) : (
          <>
            <dl className="kv">
              {limitLine("Por dia", limit.usdPerDay, limit.tokensPerDay)}
              {limitLine("Por mês", limit.usdPerMonth, limit.tokensPerMonth)}
            </dl>
            <p className="small muted">
              {hasAnyLimit(limit)
                ? "Definido pelo administrador para quem usa a chave global. Com a sua própria chave, o limite passa a ser seu."
                : "Sem limite definido pelo administrador. Com a sua própria chave, o limite passa a ser seu."}
            </p>
          </>
        )}
      </section>
    </>
  );
}
