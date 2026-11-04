"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  AI_SERVICES,
  SECRET_KINDS,
  type AiModels,
  type ModelAssignment,
  type ModelChoice,
  type ServiceOverview,
} from "@/modules/ai-credentials";
import type { UsageOverview, UsageSummary } from "@/modules/ai-usage";
import type { AppSettings } from "@/modules/settings";
import { BackIcon, KeyIcon } from "../icons";
import { CredentialCard } from "../shell/credential-card";
import { ServerSettingsCard } from "../shell/server-settings-card";
import { AiUsageSection } from "./ai-usage-section";
import { BudgetCard } from "./budget-card";
import { LevelSourcesCard, type LevelSourcesView } from "./level-sources-card";
import { ModelChoiceCard } from "./model-choice-card";
import { ServerUsageSection } from "./server-usage-section";

export type SettingsTab = "ai" | "usage" | "catalog" | "server";
export type SettingsScope = "user" | "global";

export type SettingsView = {
  tab: SettingsTab;
  scope: SettingsScope;
  isAdmin: boolean;
  name: string;
  credentials: ServiceOverview[];
  usage: UsageSummary;
  overview: UsageOverview | null;
  settings: AppSettings | null;
  aiModels: AiModels;
  assignedModel: ModelChoice | null;
  assignments: ModelAssignment[];
  aiDefaults: { aiGeneration: AppSettings["aiGeneration"]; aiEmbedding: AppSettings["aiEmbedding"] };
  customEndpointsAllowed: boolean;
  levelSources: LevelSourcesView | null;
};

const TABS: { key: SettingsTab; adminOnly?: boolean }[] = [
  { key: "ai" },
  { key: "usage" },
  { key: "catalog" },
  { key: "server", adminOnly: true },
];

const AI_SERVICE_SET = new Set<string>(AI_SERVICES);

function href(tab: SettingsTab, scope: SettingsScope): string {
  return scope === "global" ? `/settings?tab=${tab}&scope=global` : `/settings?tab=${tab}`;
}

function ScopeSwitch({ view, mine, server }: { view: SettingsView; mine: string; server: string }) {
  const t = useTranslations("settings");
  if (!view.isAdmin) return null;
  return (
    <div className="seg" aria-label={t("scope")}>
      <Link
        className={view.scope === "user" ? "on" : ""}
        href={href(view.tab, "user")}
        aria-current={view.scope === "user" ? "true" : undefined}
      >
        {mine}
      </Link>
      <Link
        className={view.scope === "global" ? "on" : ""}
        href={href(view.tab, "global")}
        aria-current={view.scope === "global" ? "true" : undefined}
      >
        {server}
      </Link>
    </div>
  );
}

function KeysTab({
  view,
  services,
  intro,
}: {
  view: SettingsView;
  services: ServiceOverview[];
  intro: string;
}) {
  const t = useTranslations("settings");
  return (
    <>
      <p className="small muted">{intro}</p>
      <ScopeSwitch view={view} mine={t("myKeys")} server={t("serverKeys")} />
      {view.scope === "global" ? <p className="small muted">{t("globalKeysNote")}</p> : null}
      {services.map((entry) => (
        <CredentialCard key={entry.service} entry={entry} scope={view.scope} />
      ))}
    </>
  );
}

function AccountsLink() {
  const t = useTranslations("settings");
  return (
    <div className="card" style={{ padding: "4px 16px" }}>
      <div className="ep" style={{ gridTemplateColumns: "1fr" }}>
        <Link className="scen" href="/accounts">
          <span className="ic">
            <KeyIcon />
          </span>
          <span className="col" style={{ gap: 3, minWidth: 0 }}>
            <b>{t("accounts")}</b>
            <span className="small muted">{t("accountsDetail")}</span>
          </span>
          <span style={{ color: "var(--muted)", width: 20, transform: "rotate(180deg)" }}>
            <BackIcon />
          </span>
        </Link>
      </div>
    </div>
  );
}

export function SettingsScreen({ view }: { view: SettingsView }) {
  const t = useTranslations("settings");
  const aiServices = view.credentials.filter(
    (entry) =>
      AI_SERVICE_SET.has(entry.service) &&
      (view.customEndpointsAllowed || SECRET_KINDS[entry.service] !== "endpoint"),
  );
  const catalogServices = view.credentials.filter((entry) => !AI_SERVICE_SET.has(entry.service));
  return (
    <>
      <h1 style={{ fontSize: 28, paddingTop: 4 }}>{t("title")}</h1>
      <div className="chips" role="tablist" aria-label={t("sections")}>
        {TABS.filter((tab) => !tab.adminOnly || view.isAdmin).map((tab) => (
          <Link
            key={tab.key}
            className={`fchip ${view.tab === tab.key ? "on" : ""}`}
            href={href(tab.key, view.scope)}
            role="tab"
            aria-selected={view.tab === tab.key}
          >
            {t(`tabs.${tab.key}`)}
          </Link>
        ))}
      </div>
      <div className="col" style={{ gap: 18, maxWidth: 640, width: "100%" }}>
        {view.tab === "ai" ? (
          <>
            <p className="small muted">{t("aiIntro")}</p>
            <ScopeSwitch view={view} mine={t("myKeys")} server={t("serverKeys")} />
            <ModelChoiceCard
              view={{
                scope: view.scope,
                models: view.aiModels,
                assigned: view.assignedModel,
                defaults: view.aiDefaults,
                credentials: view.credentials,
                customEndpointsAllowed: view.customEndpointsAllowed,
              }}
            />
            {view.scope === "user" ? <BudgetCard summary={view.usage} /> : null}
            <span className="eyebrow">{t("providers")}</span>
            {view.scope === "global" ? <p className="small muted">{t("globalKeysNote")}</p> : null}
            {aiServices.map((entry) => (
              <CredentialCard key={entry.service} entry={entry} scope={view.scope} />
            ))}
          </>
        ) : null}
        {view.tab === "usage" ? (
          <>
            <ScopeSwitch view={view} mine={t("myUsage")} server={t("server")} />
            {view.scope === "global" && view.overview ? (
              <ServerUsageSection
                view={{
                  overview: view.overview,
                  assignments: view.assignments,
                  serverDefault: view.aiDefaults.aiGeneration,
                  sharedServices: AI_SERVICES.filter((service) =>
                    aiServices.some((entry) => entry.service === service && entry.global.source !== null),
                  ),
                }}
              />
            ) : (
              <AiUsageSection summary={view.usage} />
            )}
          </>
        ) : null}
        {view.tab === "catalog" ? (
          <>
            <KeysTab view={view} services={catalogServices} intro={t("catalogIntro")} />
            {view.levelSources ? <LevelSourcesCard view={view.levelSources} /> : null}
          </>
        ) : null}
        {view.tab === "server" && view.settings ? (
          <>
            <p className="small muted">{t("serverIntro")}</p>
            <AccountsLink />
            <ServerSettingsCard initial={view.settings} />
          </>
        ) : null}
      </div>
    </>
  );
}
