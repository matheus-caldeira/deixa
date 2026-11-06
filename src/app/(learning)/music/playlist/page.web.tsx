"use client";

import { Suspense } from "react";
import { PlaylistScreen } from "@/ui/music/playlist-screen";
import { useQueryInput } from "@/ui/web/query";
import { ViewLoader } from "@/ui/web/view-loader";

function WebView() {
  const input = useQueryInput(["id"]);
  return (
    <ViewLoader name="view.playlist" input={input}>
      {(view) => <PlaylistScreen view={view} />}
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
