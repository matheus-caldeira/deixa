import { getContainer } from "@/infrastructure/container";
import { SCENARIOS } from "@/modules/gamification";
import { TalkScreen } from "@/ui/talk/talk-screen";
import { requireUser } from "../../session";

export default async function TutorPage() {
  const user = await requireUser();
  const keyStatus = await getContainer().getKeyStatus(user.id);
  return (
    <TalkScreen scenarios={[...SCENARIOS]} userLevel={user.preferences.level} hasKey={keyStatus.connected} />
  );
}
