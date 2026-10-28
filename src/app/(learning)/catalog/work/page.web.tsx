"use client";

import { Suspense } from "react";
import { MediaDetailScreen } from "@/ui/catalog/media-detail-screen";
import { useQueryInput } from "@/ui/web/query";
import { ViewLoader } from "@/ui/web/view-loader";

function WebView() {
  const input = useQueryInput(["id", "season"]);
  return (
    <ViewLoader name="view.work" input={input}>
      {({ viewKey, ...rest }) => <MediaDetailScreen key={viewKey} {...rest} />}
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
