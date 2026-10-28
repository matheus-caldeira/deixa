"use client";

import { Suspense } from "react";
import { LessonScreen } from "@/ui/study/lesson-screen";
import { useQueryInput } from "@/ui/web/query";
import { ToastProvider } from "@/ui/shell/toast";
import { ViewLoader } from "@/ui/web/view-loader";

function WebView() {
  const input = useQueryInput(["id", "node"]);
  return (
    <ViewLoader name="view.personalLesson" input={input}>
      {({ viewKey, ...props }) => <LessonScreen key={viewKey} {...props} />}
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
