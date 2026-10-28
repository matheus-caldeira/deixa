"use client";

import { TalkScreen } from "@/ui/talk/talk-screen";
import { ViewLoader } from "@/ui/web/view-loader";

export default function WebPage() {
  return <ViewLoader name="view.tutor">{(view) => <TalkScreen {...view} />}</ViewLoader>;
}
