"use client";

import { SeriesScreen } from "@/ui/series/series-screen";
import { ViewLoader } from "@/ui/web/view-loader";

export default function WebPage() {
  return <ViewLoader name="view.series">{(view) => <SeriesScreen {...view} />}</ViewLoader>;
}
