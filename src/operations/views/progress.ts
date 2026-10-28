import { z } from "zod";
import type { ComponentProps } from "react";
import { ACHIEVEMENTS } from "@/modules/gamification";
import { operation } from "../operation";
import type { ProgressScreen } from "@/ui/progress/progress-screen";

export const progressView = {
  "view.progress": operation({
    input: z.undefined(),
    run: async (context, _input): Promise<ComponentProps<typeof ProgressScreen>> => {
      const { user, app } = context;

      const summary = await app.getProfileSummary({
        userId: user.id,
        dailyGoal: user.preferences.dailyGoal,
        timezone: user.preferences.timezone,
      });

      return {
        view: {
          level: user.preferences.level,
          levelPct: summary.levelPct,
          streak: summary.streak,
          longest: summary.longestStreak,
          totalXp: summary.totalXp,
          learned: summary.learned,
          accuracy: summary.accuracy,
          dailyGoal: summary.dailyGoal,
          goalMet: summary.goalMet,
          weekly: summary.weekly,
          heat: summary.heat,
          skills: summary.skills,
          achievements: ACHIEVEMENTS.map((achievement) => ({
            ...achievement,
            unlocked: summary.achievements.includes(achievement.id),
          })),
        },
      };
    },
  }),
};
