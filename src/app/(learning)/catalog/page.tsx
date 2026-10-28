import { CatalogScreen } from "@/ui/catalog/catalog-screen";
import { loadView } from "@/app/views";

export default async function Page() {
  return <CatalogScreen {...await loadView("view.catalog")} />;
}
