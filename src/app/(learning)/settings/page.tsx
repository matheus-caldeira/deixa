import { getContainer } from "@/infrastructure/container";
import { SettingsScreen, type SettingsScope, type SettingsTab } from "@/ui/settings/settings-screen";
import { requireUser } from "../../session";

const TABS: SettingsTab[] = ["ai", "usage", "catalog", "server"];

export default async function SettingsPage(props: {
  searchParams: Promise<{ tab?: string; scope?: string }>;
}) {
  const user = await requireUser();
  const params = await props.searchParams;
  const container = getContainer();
  const requested = TABS.find((tab) => tab === params.tab) ?? "ai";
  const tab = requested === "server" && !user.isAdmin ? "ai" : requested;
  const scope: SettingsScope = user.isAdmin && params.scope === "global" ? "global" : "user";
  const actor = { userId: user.id, isAdmin: user.isAdmin };
  const [credentials, usage, overview, settings] = await Promise.all([
    container.getCredentialOverview(actor),
    container.getAiUsageSummary(user.id),
    user.isAdmin && tab === "usage" && scope === "global" ? container.getAiUsageOverview(actor) : null,
    user.isAdmin ? container.getSettings() : null,
  ]);
  return (
    <SettingsScreen
      view={{ tab, scope, isAdmin: user.isAdmin, name: user.name, credentials, usage, overview, settings }}
    />
  );
}
