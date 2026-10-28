"use client";

import { CatalogScreen } from "@/ui/catalog/catalog-screen";
import { ViewLoader } from "@/ui/web/view-loader";

export default function WebPage() {
  return <ViewLoader name="view.catalog">{(view) => <CatalogScreen {...view} />}</ViewLoader>;
}
