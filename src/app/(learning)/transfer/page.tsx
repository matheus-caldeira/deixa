import { TransferScreen } from "@/ui/transfer/transfer-screen";
import { loadView } from "@/app/views";

export default async function Page(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <TransferScreen {...await loadView("view.transfer", await props.searchParams)} />;
}
