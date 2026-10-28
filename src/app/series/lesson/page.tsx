import { ToastProvider } from "@/ui/shell/toast";
import { LessonScreen } from "@/ui/study/lesson-screen";
import { loadView } from "@/app/views";

export const dynamic = "force-dynamic";

export default async function Page(page: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { viewKey, ...props } = await loadView("view.personalLesson", await page.searchParams);
  return (
    <ToastProvider>
      <LessonScreen key={viewKey} {...props} />
    </ToastProvider>
  );
}
