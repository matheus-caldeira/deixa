import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getContainer } from "@/infrastructure/container";
import { pairOf } from "@/modules/identity";
import { isAppError } from "@/shared/errors";
import { ToastProvider } from "@/ui/shell/toast";
import { LessonScreen } from "@/ui/study/lesson-screen";
import { requireUser } from "../../../../session";

export const dynamic = "force-dynamic";

export default async function PersonalLessonPage(props: {
  params: Promise<{ episodeId: string; node: string }>;
}) {
  const user = await requireUser();
  const { episodeId, node } = await props.params;
  const nodeIndex = Number(node);
  if (!z.uuid().safeParse(episodeId).success || !Number.isInteger(nodeIndex) || nodeIndex < 0) notFound();
  const lesson = await getContainer()
    .startPersonalLesson({
      userId: user.id,
      pair: pairOf(user.preferences),
      level: user.preferences.level,
      episodeId,
      nodeIndex,
    })
    .catch((error: unknown) => {
      if (isAppError(error)) redirect(`/series/${episodeId}`);
      throw error;
    });
  return (
    <ToastProvider>
      <LessonScreen
        key={`${episodeId}:${nodeIndex}`}
        view={{
          episodeId,
          nodeIndex,
          seed: lesson.seed,
          title: lesson.title,
          level: user.preferences.level,
          replay: lesson.replay,
          audioSpeed: user.preferences.audioSpeed,
          exercises: lesson.exercises,
          source: "personal",
        }}
      />
    </ToastProvider>
  );
}
