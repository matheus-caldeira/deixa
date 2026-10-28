import { ToastProvider } from "@/ui/shell/toast";
import { ChatScreen } from "@/ui/talk/chat-screen";
import { loadView } from "@/app/views";

export const dynamic = "force-dynamic";

export default async function Page(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <ToastProvider>
      <ChatScreen {...await loadView("view.conversation", await props.searchParams)} />
    </ToastProvider>
  );
}
