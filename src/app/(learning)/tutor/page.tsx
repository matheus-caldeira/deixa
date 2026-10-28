import { TalkScreen } from "@/ui/talk/talk-screen";
import { loadView } from "@/app/views";

export default async function Page() {
  return <TalkScreen {...await loadView("view.tutor")} />;
}
