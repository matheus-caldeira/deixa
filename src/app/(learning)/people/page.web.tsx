"use client";

import { PeopleScreen } from "@/ui/people/people-screen";
import { ViewLoader } from "@/ui/web/view-loader";

export default function WebPage() {
  return <ViewLoader name="view.people">{(view) => <PeopleScreen {...view} />}</ViewLoader>;
}
