import { getContainer } from "@/infrastructure/container";
import { AppShell } from "@/ui/shell/app-shell";
import { ToastProvider } from "@/ui/shell/toast";
import { requireUser } from "../session";

export const dynamic = "force-dynamic";

export default async function LearningLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const container = getContainer();
  const [summary, keyStatus] = await Promise.all([
    container.getProfileSummary({
      userId: user.id,
      dailyGoal: user.preferences.dailyGoal,
      timezone: user.preferences.timezone,
    }),
    container.getKeyStatus(user.id),
  ]);
  return (
    <ToastProvider>
      <AppShell
        data={{
          name: user.name,
          avatarColor: user.avatarColor,
          level: user.preferences.level,
          streak: summary.streak,
          xpToday: summary.xpToday,
          goalMet: summary.goalMet,
          devShortcuts: container.devShortcuts,
          profile: {
            name: user.name,
            avatarColor: user.avatarColor,
            level: user.preferences.level,
            dailyGoal: user.preferences.dailyGoal,
            accent: user.preferences.preferredAccent,
            audioSpeed: user.preferences.audioSpeed,
            maskedKey: keyStatus.masked,
            metadataProvider: container.providers.metadata,
          },
        }}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
