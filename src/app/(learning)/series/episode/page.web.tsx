"use client";

import { Suspense } from "react";
import { EpisodeTrailScreen } from "@/ui/series/episode-trail-screen";
import { useQueryInput } from "@/ui/web/query";
import { ViewLoader } from "@/ui/web/view-loader";

function WebView() {
  const input = useQueryInput(["id"]);
  return (
    <ViewLoader name="view.seriesEpisode" input={input}>
      {(view) => <EpisodeTrailScreen {...view} />}
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
