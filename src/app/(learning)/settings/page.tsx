import { SettingsScreen } from "@/ui/settings/settings-screen";
import { loadView } from "@/app/views";

export default async function Page(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <SettingsScreen {...await loadView("view.settings", await props.searchParams)} />;
}
