"use client";

import { MusicHomeScreen } from "@/ui/music/music-home-screen";
import { ViewLoader } from "@/ui/web/view-loader";

export default function WebPage() {
  return <ViewLoader name="view.music">{(view) => <MusicHomeScreen view={view} />}</ViewLoader>;
}
