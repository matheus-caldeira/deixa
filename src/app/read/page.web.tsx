"use client";

import { Suspense } from "react";
import { ReadScreen } from "@/ui/read/read-screen";
import { useQueryInput } from "@/ui/web/query";
import { ToastProvider } from "@/ui/shell/toast";
import { ViewLoader } from "@/ui/web/view-loader";

function WebView() {
  const input = useQueryInput(["id", "batch"]);
  return (
    <ViewLoader name="view.read" input={input}>
      {({ viewKey, ...props }) => <ReadScreen key={viewKey} {...props} />}
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
