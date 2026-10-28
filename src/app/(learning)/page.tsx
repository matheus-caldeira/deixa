import { HomeScreen } from "@/ui/home/home-screen";
import { loadView } from "../views";

export default async function HomePage() {
  return <HomeScreen view={await loadView("view.home")} />;
}
