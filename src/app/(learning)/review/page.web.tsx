"use client";

import { Suspense } from "react";
import { ReviewPage } from "@/ui/review/review-page";
import { useQueryInput } from "@/ui/web/query";
import { ViewLoader } from "@/ui/web/view-loader";

function WebView() {
  const input = useQueryInput(["tab"]);
  return (
    <ViewLoader name="view.review" input={input}>
      {(page) => <ReviewPage page={page} />}
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
