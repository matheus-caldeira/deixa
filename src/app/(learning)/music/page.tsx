import { MusicHomeScreen } from "@/ui/music/music-home-screen";
import { loadView } from "@/app/views";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <MusicHomeScreen view={await loadView("view.music")} />;
}
