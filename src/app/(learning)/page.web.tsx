"use client";

import { HomeScreen } from "@/ui/home/home-screen";
import { ViewLoader } from "@/ui/web/view-loader";

export default function WebHomePage() {
  return <ViewLoader name="view.home">{(view) => <HomeScreen view={view} />}</ViewLoader>;
}
