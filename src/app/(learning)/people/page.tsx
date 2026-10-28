import { PeopleScreen } from "@/ui/people/people-screen";
import { loadView } from "@/app/views";

export default async function Page() {
  return <PeopleScreen {...await loadView("view.people")} />;
}
