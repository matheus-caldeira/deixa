import { z } from "zod";
import { unreadableCredentials } from "@/modules/ai-credentials";
import { pairOf } from "@/modules/identity";
import { operation } from "../operation";

export const shellViews = {
  "view.shell": operation({
    input: z.undefined(),
    run: async ({ user, app }) => {
      const [summary, credentials, metadataProvider, pairs] = await Promise.all([
        app.getProfileSummary({
          userId: user.id,
          dailyGoal: user.preferences.dailyGoal,
          timezone: user.preferences.timezone,
        }),
        app.getCredentialOverview({ userId: user.id, isAdmin: user.isAdmin }),
        app.metadataNameFor(user.id),
        app.listLanguagePairs(user.id),
      ]);
      const unreadable = unreadableCredentials(credentials);
      return {
        name: user.name,
        avatarColor: user.avatarColor,
        level: user.preferences.level,
        streak: summary.streak,
        xpToday: summary.xpToday,
        goalMet: summary.goalMet,
        devShortcuts: app.devShortcuts,
        pair: pairOf(user.preferences),
        unreadableKeys: [...unreadable.own, ...unreadable.global.map((label) => `${label} (global)`)],
        profile: {
          name: user.name,
          avatarColor: user.avatarColor,
          level: user.preferences.level,
          dailyGoal: user.preferences.dailyGoal,
          accent: user.preferences.preferredAccent,
          audioSpeed: user.preferences.audioSpeed,
          metadataProvider,
          pairs,
        },
      };
    },
  }),
};
