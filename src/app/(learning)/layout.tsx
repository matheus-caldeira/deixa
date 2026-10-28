import { AppShell } from "@/ui/shell/app-shell";
import { ToastProvider } from "@/ui/shell/toast";
import { loadView } from "../views";

export const dynamic = "force-dynamic";

export default async function LearningLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AppShell data={await loadView("view.shell")}>{children}</AppShell>
    </ToastProvider>
  );
}
