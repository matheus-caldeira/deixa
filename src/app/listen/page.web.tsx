"use client";

import { Suspense } from "react";
import { ListenScreen } from "@/ui/music/listen-screen";
import { useQueryInput } from "@/ui/web/query";
import { ToastProvider } from "@/ui/shell/toast";
import { ViewLoader } from "@/ui/web/view-loader";

function WebView() {
  const input = useQueryInput(["episode"]);
  return (
    <ViewLoader name="view.listen" input={input}>
      {(view) => <ListenScreen key={view.episodeId} view={view} />}
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
