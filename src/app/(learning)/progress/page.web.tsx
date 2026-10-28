"use client";

import { ProgressScreen } from "@/ui/progress/progress-screen";
import { ViewLoader } from "@/ui/web/view-loader";

export default function WebPage() {
  return <ViewLoader name="view.progress">{(view) => <ProgressScreen {...view} />}</ViewLoader>;
}
