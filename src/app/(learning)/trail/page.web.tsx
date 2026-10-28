"use client";

import { Suspense } from "react";
import { WorkTrailScreen } from "@/ui/trail/work-trail-screen";
import { useQueryInput } from "@/ui/web/query";
import { ViewLoader } from "@/ui/web/view-loader";

function WebView() {
  const input = useQueryInput(["id", "season"]);
  return (
    <ViewLoader name="view.trail" input={input}>
      {(view) => <WorkTrailScreen {...view} />}
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
