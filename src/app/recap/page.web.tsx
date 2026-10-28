"use client";

import { Suspense } from "react";
import { RecapScreen } from "@/ui/review/recap-screen";
import { useQueryInput } from "@/ui/web/query";
import { ToastProvider } from "@/ui/shell/toast";
import { ViewLoader } from "@/ui/web/view-loader";

function WebView() {
  const input = useQueryInput(["id"]);
  return (
    <ViewLoader name="view.recap" input={input}>
      {(view) => <RecapScreen {...view} />}
    </ViewLoader>
  );
}

export default function WebPage() {
  return (
    <ToastProvider>
      <Suspense>
        <WebView />
      </Suspense>
    </ToastProvider>
  );
}
