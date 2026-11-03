"use client";

import { AccountsScreen } from "@/ui/accounts/accounts-screen";
import { ViewLoader } from "@/ui/web/view-loader";

export default function WebPage() {
  return <ViewLoader name="view.accounts">{(view) => <AccountsScreen {...view} />}</ViewLoader>;
}
