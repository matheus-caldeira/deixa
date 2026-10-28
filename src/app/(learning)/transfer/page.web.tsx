"use client";

import { Suspense } from "react";
import { TransferScreen } from "@/ui/transfer/transfer-screen";
import { useQueryInput } from "@/ui/web/query";
import { ViewLoader } from "@/ui/web/view-loader";

function WebView() {
  const input = useQueryInput(["mediaId", "erro"]);
  return (
    <ViewLoader name="view.transfer" input={input}>
      {(view) => <TransferScreen {...view} />}
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
