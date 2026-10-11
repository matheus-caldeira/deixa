import { getContainer } from "@/infrastructure/container";
import { THEMES } from "@/modules/conversations";
import { TalkScreen } from "@/ui/talk/talk-screen";
import { requireUser } from "../../session";

export default async function TutorPage() {
  const user = await requireUser();
  const container = getContainer();
  const [recent, simulated] = await Promise.all([
    container.listConversations(user.id),
    container.isTutorSimulated(user.id),
  ]);
  return (
    <TalkScreen
      simulated={simulated}
      themes={THEMES.map((theme) => ({
        id: theme.id,
        icon: theme.icon,
        title: theme.title,
        detail: theme.detail,
      }))}
      recent={recent.map((session) => ({
        id: session.id,
        title: session.themeTitle,
        turnCount: session.turnCount,
        reviewed: session.review !== null,
        score: session.review?.score ?? null,
      }))}
    />
  );
}
