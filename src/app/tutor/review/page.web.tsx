"use client";

import { Suspense } from "react";
import { ConversationReviewScreen } from "@/ui/talk/conversation-review-screen";
import { useQueryInput } from "@/ui/web/query";
import { ToastProvider } from "@/ui/shell/toast";
import { ViewLoader } from "@/ui/web/view-loader";

function WebView() {
  const input = useQueryInput(["id"]);
  return (
    <ViewLoader name="view.conversationReview" input={input}>
      {(view) => <ConversationReviewScreen {...view} />}
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
