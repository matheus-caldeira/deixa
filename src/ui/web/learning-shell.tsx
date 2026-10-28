"use client";

import { AppShell } from "../shell/app-shell";
import { ToastProvider } from "../shell/toast";
import { ViewLoader } from "./view-loader";

export function WebLearningShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ViewLoader name="view.shell">{(data) => <AppShell data={data}>{children}</AppShell>}</ViewLoader>
    </ToastProvider>
  );
}
