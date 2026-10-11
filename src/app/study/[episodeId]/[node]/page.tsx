import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getContainer } from "@/infrastructure/container";
import { isAppError } from "@/shared/errors";
import { ToastProvider } from "@/ui/shell/toast";
import { LessonScreen } from "@/ui/study/lesson-screen";
import { requireUser } from "../../../session";

export const dynamic = "force-dynamic";

export default async function StudyPage(props: { params: Promise<{ episodeId: string; node: string }> }) {
  const user = await requireUser();
  const { episodeId, node } = await props.params;
  const nodeIndex = Number(node);
  if (!z.uuid().safeParse(episodeId).success || !Number.isInteger(nodeIndex) || nodeIndex < 0) notFound();
  const lesson = await getContainer()
    .startLesson({ userId: user.id, episodeId, nodeIndex, level: user.preferences.level })
    .catch((error: unknown) => {
      if (isAppError(error)) redirect("/");
      throw error;
    });
  return (
    <ToastProvider>
      <LessonScreen
        key={`${episodeId}:${nodeIndex}`}
        view={{
          episodeId,
          nodeIndex: lesson.nodeIndex,
          title: lesson.title,
          level: user.preferences.level,
          replay: lesson.replay,
          audioSpeed: user.preferences.audioSpeed,
          exercises: lesson.exercises,
        }}
      />
    </ToastProvider>
  );
}
