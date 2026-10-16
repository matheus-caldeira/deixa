import { getContainer } from "@/infrastructure/container";
import { THEMES } from "@/modules/conversations";
import { TalkScreen } from "@/ui/talk/talk-screen";
import { requireUser } from "../../session";

export default async function TutorPage() {
  const user = await requireUser();
  const container = getContainer();
  const [recent, simulated, learner] = await Promise.all([
    container.listConversations(user.id, user.preferences.targetLanguage),
    container.isTutorSimulated(user.id),
    container.getLearnerProfile(user.id, user.preferences.targetLanguage),
  ]);
  return (
    <TalkScreen
      simulated={simulated}
      learner={{
        improvements: learner.improvements,
        strengths: learner.strengths,
        mistakes: learner.mistakes,
      }}
      themes={THEMES.map((theme) => ({ id: theme.id, icon: theme.icon }))}
      recent={recent.map((session) => ({
        id: session.id,
        themeId: session.themeId,
        title: session.themeTitle,
        turnCount: session.turnCount,
        reviewed: session.review !== null,
        score: session.review?.score ?? null,
      }))}
    />
  );
}
