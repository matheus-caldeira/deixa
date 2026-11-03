import { AccountsScreen } from "@/ui/accounts/accounts-screen";
import { loadView } from "@/app/views";

export default async function Page() {
  return <AccountsScreen {...await loadView("view.accounts")} />;
}
