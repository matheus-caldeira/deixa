import { getContainer } from "@/infrastructure/container";
import { ACHIEVEMENTS } from "@/modules/gamification";
import { ProgressScreen } from "@/ui/progress/progress-screen";
import { requireUser } from "../../session";

export default async function ProgressPage() {
  const user = await requireUser();
  const summary = await getContainer().getProfileSummary({
    userId: user.id,
    dailyGoal: user.preferences.dailyGoal,
    timezone: user.preferences.timezone,
  });
  return (
    <ProgressScreen
      view={{
        level: user.preferences.level,
        levelPct: summary.levelPct,
        nextStep: summary.nextStep,
        streak: summary.streak,
        longest: summary.longest,
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
      }}
    />
  );
}
