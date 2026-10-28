"use client";

import { Suspense } from "react";
import { TmdbBrowseScreen } from "@/ui/catalog/tmdb-browse-screen";
import { useQueryInput } from "@/ui/web/query";
import { ViewLoader } from "@/ui/web/view-loader";

function WebView() {
  const input = useQueryInput(["q", "type", "lang", "sort", "page"]);
  return (
    <ViewLoader name="view.tmdb" input={input}>
      {(view) => <TmdbBrowseScreen {...view} />}
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
