"use client";

import { Suspense } from "react";
import { SettingsScreen } from "@/ui/settings/settings-screen";
import { useQueryInput } from "@/ui/web/query";
import { ViewLoader } from "@/ui/web/view-loader";

function WebView() {
  const input = useQueryInput(["tab", "scope"]);
  return (
    <ViewLoader name="view.settings" input={input}>
      {(view) => <SettingsScreen {...view} />}
    </ViewLoader>
  );
}

export default function WebPage() {
  return (
    <Suspense>
      <WebView />
    </Suspense>
  );
}
