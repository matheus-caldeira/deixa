"use client";

import Link from "next/link";
import type { ServiceOverview } from "@/modules/ai-credentials";
import type { UsageOverview, UsageSummary } from "@/modules/ai-usage";
import type { AppSettings } from "@/modules/settings";
import { CredentialCard } from "../shell/credential-card";
import { ServerSettingsCard } from "../shell/server-settings-card";
import { AiUsageSection } from "./ai-usage-section";
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
};

const TABS: { key: SettingsTab; label: string; adminOnly?: boolean }[] = [
  { key: "ai", label: "IA" },
  { key: "usage", label: "Uso da IA" },
  { key: "catalog", label: "Catálogo" },
  { key: "server", label: "Servidor", adminOnly: true },
];

const AI_SERVICES = new Set(["gemini"]);

function href(tab: SettingsTab, scope: SettingsScope): string {
  return scope === "global" ? `/settings?tab=${tab}&scope=global` : `/settings?tab=${tab}`;
}

function ScopeSwitch({ view, mine, server }: { view: SettingsView; mine: string; server: string }) {
  if (!view.isAdmin) return null;
  return (
    <div className="seg" aria-label="Alcance">
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
  return (
    <>
      <p className="small muted">{intro}</p>
      <ScopeSwitch view={view} mine="Minhas chaves" server="Globais do servidor" />
      {view.scope === "global" ? (
        <p className="small muted">
          Valem para qualquer conta que não tenha a própria chave. Só você, como administrador, pode
          alterá-las.
        </p>
      ) : null}
      {services.map((entry) => (
        <CredentialCard key={entry.service} entry={entry} scope={view.scope} />
      ))}
    </>
  );
}

export function SettingsScreen({ view }: { view: SettingsView }) {
  const aiServices = view.credentials.filter((entry) => AI_SERVICES.has(entry.service));
  const catalogServices = view.credentials.filter((entry) => !AI_SERVICES.has(entry.service));
  return (
    <>
      <h1 style={{ fontSize: 28, paddingTop: 4 }}>Configurações</h1>
      <div className="chips" role="tablist" aria-label="Seções">
        {TABS.filter((tab) => !tab.adminOnly || view.isAdmin).map((tab) => (
          <Link
            key={tab.key}
            className={`fchip ${view.tab === tab.key ? "on" : ""}`}
            href={href(tab.key, view.scope)}
            role="tab"
            aria-selected={view.tab === tab.key}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <div className="col" style={{ gap: 18, maxWidth: 640, width: "100%" }}>
        {view.tab === "ai" ? (
          <KeysTab
            view={view}
            services={aiServices}
            intro="A IA explica o que você marca, monta trilhas, sugere obras e conversa com você. Sem a sua chave, vale a chave global deste servidor, se houver. As chaves ficam criptografadas e nunca voltam para o navegador."
          />
        ) : null}
        {view.tab === "usage" ? (
          <>
            <ScopeSwitch view={view} mine="Meu uso" server="Servidor" />
            {view.scope === "global" && view.overview ? (
              <ServerUsageSection overview={view.overview} />
            ) : (
              <AiUsageSection summary={view.usage} />
            )}
          </>
        ) : null}
        {view.tab === "catalog" ? (
          <KeysTab
            view={view}
            services={catalogServices}
            intro="O TMDB identifica as obras e o OpenSubtitles busca legendas quando você pede. Sem a sua chave, valem as globais deste servidor, se houver."
          />
        ) : null}
        {view.tab === "server" && view.settings ? (
          <>
            <p className="small muted">Valem para a instalação inteira. Só o administrador vê esta aba.</p>
            <ServerSettingsCard initial={view.settings} />
          </>
        ) : null}
      </div>
    </>
  );
}
