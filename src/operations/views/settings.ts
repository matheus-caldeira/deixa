import { z } from "zod";
import type { ComponentProps } from "react";
import type { SettingsScope, SettingsTab } from "@/ui/settings/settings-screen";
import { operation } from "../operation";
import type { SettingsScreen } from "@/ui/settings/settings-screen";

const TABS: SettingsTab[] = ["ai", "usage", "catalog", "server"];

export const settingsView = {
  "view.settings": operation({
    input: z.object({ tab: z.string().optional(), scope: z.string().optional() }),
    run: async (context, input): Promise<ComponentProps<typeof SettingsScreen>> => {
      const { user, app } = context;

      const params = input;
      const requested = TABS.find((tab) => tab === params.tab) ?? "ai";
      const tab = requested === "server" && !user.isAdmin ? "ai" : requested;
      const scope: SettingsScope = user.isAdmin && params.scope === "global" ? "global" : "user";
      const actor = { userId: user.id, isAdmin: user.isAdmin };
      const serverUsage = user.isAdmin && tab === "usage" && scope === "global";
      const levelSourcesWanted = user.isAdmin && tab === "catalog";
      const [credentials, usage, overview, settings, aiModels, assignedModel, assignments, levelSources] =
        await Promise.all([
          app.getCredentialOverview(actor),
          app.getAiUsageSummary(user.id),
          serverUsage ? app.getAiUsageOverview(actor) : null,
          app.getSettings(),
          app.getAiModels(user.id),
          app.getAssignedModel(user.id),
          serverUsage ? app.listModelAssignments(actor) : [],
          levelSourcesWanted ? app.listLevelSources({ actor }) : null,
        ]);

      return {
        view: {
          tab,
          scope,
          isAdmin: user.isAdmin,
          name: user.name,
          credentials,
          usage,
          overview,
          settings: user.isAdmin ? settings : null,
          aiModels,
          assignedModel,
          assignments,
          aiDefaults: { aiGeneration: settings.aiGeneration, aiEmbedding: settings.aiEmbedding },
          customEndpointsAllowed: settings.aiCustomEndpointsAllowed,
          levelSources: levelSources
            ? {
                builtinCount: levelSources.builtinCount,
                sources: levelSources.sources.map((source) => ({
                  id: source.id,
                  url: source.url,
                  name: source.name,
                  parentId: source.parentId,
                  enabled: source.enabled,
                  status: source.status,
                  ratingCount: source.ratingCount,
                  rejectedCount: source.rejectedCount,
                  lastError: source.lastError,
                  lastStatus: source.lastStatus,
                  fetchedAt: source.fetchedAt?.toISOString() ?? null,
                })),
              }
            : null,
        },
      };
    },
  }),
};
