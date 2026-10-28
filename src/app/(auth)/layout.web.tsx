import { ToastProvider } from "@/ui/shell/toast";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
